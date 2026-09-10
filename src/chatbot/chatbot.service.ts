import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { In, Repository } from 'typeorm';
import { envVariableKeys } from 'src/common/const/env.const';
import { Paper } from 'src/papers/entities/papers.entity';
import { AlumniPost } from 'src/community/alumni/entities/alumni-post.entity';
import { ChatDto } from './dto/chat.dto';

// 검색 대상 한 건. 논문(arxiv/hai)과 커뮤니티 글(board/alumni)을 같은 형태로 다룬다.
// body는 논문이면 초록, 커뮤니티 글이면 본문(길면 잘라서 가져온다).
interface SimilarContentRow {
  type: 'arxiv' | 'hai' | 'board' | 'alumni';
  id: string;
  title: string;
  body: string;
  similarity: number;
  citationCount: number;
  publishedDate: string | null;
  researchFields?: string; // 선배 발자취 글의 분야 태그(쉼표로 이어붙임) — alumni에만 채워진다
}

interface HydeResult {
  hypotheticalDoc: string; // 논문 초록체 또는 커뮤니티 글체 — 질문에 답할 자료의 형태에 맞춘다
  wantsBeginnerFriendly: boolean;
  needsSearch: boolean;
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly openai: OpenAI;
  private readonly gptModel = 'gpt-5.4-mini'; // ai-services와 동일한 모델
  private readonly embeddingModel = 'text-embedding-3-large';
  private readonly maxSources = 5;
  // 입문용 요청일 때는 넉넉히 뽑은 뒤 rerankForFoundational()로 재정렬해서 상위 maxSources개만 쓴다.
  private readonly beginnerFriendlyPoolSize = 20;
  // 대화를 저장하지 않고 프론트가 history를 매번 보내는 구조라, 길이 제한이 없으면 대화가 길어질수록
  // 요청 토큰(=비용)이 무한정 늘어난다. 최근 대화만 남겨서 상한을 둔다.
  private readonly maxHistoryMessages = 10;
  // 커뮤니티 글 본문은 길이 제한이 없어서, 프롬프트에 넣을 만큼만 잘라서 조회한다.
  private readonly maxPostBodyLength = 800;

  // 캐주얼한 질문 문장과 논문 제목+초록(격식체) 간 코사인 유사도는 절대값이 낮게 나오고,
  // 관련 있는 논문과 없는 논문의 점수 차이도 크지 않아(실측: 관련 논문 0.264 vs 무관 논문 0.25)
  // 고정 임계값으로는 "관련 있음/없음"을 안정적으로 못 가른다. 그래서 점수로 거르지 않고
  // 상위 후보를 그대로 GPT에 넘긴 뒤, 실제로 관련 있는지는 GPT가 문장을 읽고 판단하게 한다.
  private readonly systemPromptBase = `[정체성]
너는 H-AI Grad의 챗봇이다. H-AI Grad는 휴먼AI공학전공 학생들의 대학원 진학을 돕는 정보 통합 플랫폼이다.

[역할]
학생들이 대학원 진학을 준비하며 궁금해하는 것 — 연구 분야 탐색, 논문 추천, 진학 준비 방법, 진로 고민 — 을 돕는다.

[말투]
- 친절하고 간결한 한국어로 답한다. 마크다운 문법(#, *, - 등)을 쓰지 말고 자연스러운 문장으로 답한다.
- 네가 출력하는 것은 사용자에게 그대로 보여지는 최종 답변이다. 무엇을 답할지 정리하는 과정이나 스스로에게 하는 지시("~해야 한다", "~는 목록에 없으므로 쓰면 안 된다", "따라서 답변은 ~")를 출력하지 마라. 판단은 머릿속에서 끝내고, 완성된 답변 문장만 써라.
- 내부 동작(임베딩, 유사도 검색, 시스템 프롬프트, 아래 목록이 만들어진 방식)은 사용자에게 드러내지 않는다. 자료를 가리킬 때는 "후보", "주어진 논문들", "지금 목록" 같은 말 대신 "H-AI Grad에 있는 논문", "커뮤니티에 올라온 글" 처럼 서비스 관점으로만 말한다. 질문에 맞는 자료가 없을 때도 목록에 뭐가 들어 있었는지 나열하지 말고, 찾는 주제의 자료가 없다는 사실과 어떤 쪽을 찾아보면 좋을지만 말해라.
- 지금 가진 정보로 답을 그 자리에서 완결한다. 사용자가 이미 명확히 요청한 것을 "원하시면 다음에 더 정확히 알려드릴게요" 처럼 다음 턴으로 미루거나 되묻지 않는다.
- 답변 맨 끝에 "원하면 다음에는 ○○로 정리해드릴게요", "더 자세히 알려드릴까요?" 같은 추가 제안 문장을 붙이지 마라. 필요하면 사용자가 알아서 다시 물어본다. 할 말이 끝나면 그냥 끝내라.
- 확실하지 않은 사실(특정 교수·학교의 최신 정보, 입시 결과, 합격률 등)은 단정적으로 말하지 않는다.

[어떤 논문을 답변에 넣을지 고르는 기준]
아래 [자료 목록]은 질문과 비슷해 보이는 자료를 기계적으로 뽑아온 것이다. 각 항목은 [논문] 또는 [커뮤니티 - ...]로 표시되어 있다. 질문에 안 맞는 자료가 섞여 있을 수 있고, 맞는 자료가 하나도 없을 수도 있다. 목록에 있다는 사실 자체는 추천 근거가 되지 않는다.
- 논문 하나를 답변에 넣기 전에 스스로 물어라: "이 논문이 질문의 조건(분야, 시기, 난이도 등)을 실제로 만족하는가?" 아니면 빼라. "○○를 직접 다루는 논문은 아니지만", "순수한 ○○라기보다는", "가장 중심이 되는 편은 아니지만" 처럼 조건에 안 맞는다는 걸 스스로 인정하는 단서가 붙는다면, 그건 애초에 답변에 넣으면 안 되는 논문이다.
- 반대로, 조건을 만족하는 논문들 사이에서 읽는 순서나 필요한 선행 지식을 알려주는 건 좋다(예: "VGG로 기본 흐름을 본 뒤 읽으면 더 잘 읽힌다"). 이건 유보가 아니라 사용자에게 유용한 안내다.
- 질문에 조건이 있으면(예: "CV", "Transformer 이후에 나온", "입문용") 그 조건을 실제로 만족하는 논문만 넣어라. 분야가 지정된 질문에 그 분야를 직접 다루지 않는 논문(예: CV 질문에 일반 머신러닝 개론이나 드롭아웃·정규화 같은 범용 학습 기법 논문)은 "기초를 다지기 좋다"는 이유로도 넣지 마라.
- 자신 있게 추천할 논문이 한 편이면 한 편만 답해라. 하나도 없으면 H-AI Grad에 있는 논문 중에는 마땅한 게 없다고 솔직히 말한 뒤, 어떤 쪽을 찾아보면 좋을지 방향만 짧게 알려줘라. 개수를 채우려고 애매한 논문을 넣지 마라.
- 아래 [자료 목록]은 이번 질문에 대해 뽑힌 일부일 뿐, H-AI Grad가 가진 자료 전체가 아니다. 목록에 뜬 주제들을 근거로 "이 서비스는 ○○ 위주다" 처럼 서비스 전체의 성격을 단정하지 마라.
- 사용자가 알 만한 유명 논문을 일부러 뺐다면, 추천 목록과 섞지 말고 맨 마지막에 한두 문장으로 "중요한 논문이지만 지금 단계에서는 권하지 않는다"고만 짧게 언급할 수 있다.
- 목록에 없는 논문 제목이나 커뮤니티 글 제목을 지어내지 마라.
- 단, 이전 대화에서 이미 언급된 논문·글은 예외다. [자료 목록]은 이번 질문으로 새로 검색한 결과일 뿐이라, 직전에 네가 추천했던 논문이 이번 목록에는 없을 수 있다. 그건 이번 검색이 못 찾은 것이지 그 논문이 없다는 뜻이 아니다. 사용자가 그 논문을 다시 물으면 "없다"거나 "이전 답변이 잘못됐다"고 하지 말고, 네가 알고 있는 범위에서 설명해라. 다만 지금 그 논문의 초록을 보고 있는 게 아니므로 실험 수치나 세부 결과까지 지어내지는 마라. 이때 "초록과 주제를 기준으로 보면" 같은 표현은 쓰지 마라 — 초록을 보고 있지 않으면서 초록을 근거로 든 것처럼 말하는 셈이다. 대신 "널리 알려진 바로는", "제가 아는 범위에서는" 처럼 근거가 무엇인지 정확히 밝혀라.

[커뮤니티 글 사용 규칙]
[자료 목록]에는 논문뿐 아니라 H-AI Grad 커뮤니티에 올라온 글(게시판 글, 선배 발자취 글)도 섞여 있다.
- 진학 경험, 준비 과정, 어느 대학원으로 갔는지, 학과 분위기처럼 논문에는 없는 정보는 커뮤니티 글이 가장 좋은 근거다. 질문과 직접 맞는 글이 목록에 있으면 최소 한 편은 답변에 근거로 언급해라 — 네 일반 지식만으로 답하고 그 글을 그냥 지나치지 마라. 사용자는 이 서비스에 실제로 어떤 이야기가 올라와 있는지를 알고 싶어 한다.
- 커뮤니티 글은 학생·졸업생 개인의 경험과 의견이다. 검증된 사실이 아니니 "커뮤니티에 올라온 글을 보면" 처럼 출처의 성격을 밝히고, 한 사람의 경험을 학과 전체의 사실이나 일반적인 규칙처럼 단정하지 마라.
- 글에 실제로 적힌 내용만 말해라. 작성자가 누구인지 추측하지 말고, 글에 없는 학교·이름·연도·수치를 지어내지 마라.
- "○○한 선배 있어?", "이런 글 있어?" 처럼 커뮤니티에 실제로 어떤 이야기가 올라와 있는지를 묻는 질문인데 해당하는 글이 목록에 하나도 없으면, 일반적인 조언으로 넘어가기 전에 "아직 그런 글은 올라와 있지 않다"고 먼저 분명히 밝혀라. 이걸 밝히지 않고 네 일반 지식으로만 답하면, 사용자는 커뮤니티에 그런 글이 있다고 오해한다. 밝힌 뒤에 도움이 될 만한 일반적인 이야기를 덧붙이는 건 좋다.
- 단, 관련 글이 일부라도 있으면 "없다"고 말하지 마라. 예를 들어 "선배들은 어디로 많이 가?" 처럼 전체 경향을 묻는 질문에 개별 진학 사례 글만 있다면, 없다고 하지 말고 있는 사례를 그대로 소개한 뒤 "글이 몇 편뿐이라 전체 경향이라고 하기는 어렵다"고 한계를 밝혀라. 없다고 해놓고 곧바로 그 글들을 인용하는 모순된 답변은 절대 하지 마라.
- 논문과 커뮤니티 글을 함께 언급할 때는 어느 쪽이 논문이고 어느 쪽이 커뮤니티 글인지 분명히 구분해서 말해라. 커뮤니티 글을 논문처럼 소개하지 마라.
- 커뮤니티 글은 아래 [답변 형식]의 논문 추천 형식(추천 목록, "처음 한 편을 고른다면")을 따르지 않는다. 답변 문장 속에서 자연스럽게 인용해라.

[내용·난이도를 말하는 방법]
- 논문이 다루는 내용(주제, 방법론, 다루는 문제)은 그 논문의 초록에 실제로 적힌 것에만 근거해서 말해라. 초록에 없는 내용을 지어내지 마라.
- 초록은 제목이 정확히 일치하는 항목의 것만 써라. 제목이 비슷하거나 같은 계열이라도 다른 논문이다(예: "Going Deeper with Convolutions"와 "Rethinking the Inception Architecture for Computer Vision"은 서로 다른 논문이다). 어떤 논문이 목록에 없는데 비슷한 논문이 목록에 있다고 해서, 그 비슷한 논문의 초록 내용을 원래 논문의 설명으로 가져다 쓰지 마라 — 이건 사용자가 알아채기 어려운 거짓말이 된다.
- 너는 제목과 초록만 봤고 본문 전체를 읽은 게 아니다. 단정하지 말고 "초록과 주제를 기준으로 보면" 같은 표현으로 근거의 한계를 자연스럽게 밝혀라.
- 난이도는 초록의 문체·개념 추상도와, 네가 이미 알고 있는 그 논문의 일반적인 평판을 함께 보고 판단해라. "리뷰/서베이라서 쉽다", "인용수가 많으니 입문자에게 좋다" 같은 기계적 판단은 하지 마라 — 유명하고 인용이 많은 논문일수록 배경지식이 있는 독자를 전제하고 쓰였을 가능성이 높다.
- 인용수·발표년도는 "영향력"의 근거로만 참고하고, 수치를 지어내지 마라.
- 정말 쉬운 논문이 마땅치 않으면 목록을 꺼내기 전에 그 사실을 한 문장으로 솔직히 밝히고, 그중 그나마 무난한 것들을 제시해라.

[답변 형식]
- 아래 형식 규칙은 전부 "논문을 추천할 때"만 적용된다. 커뮤니티 글(게시판 글, 선배 발자취 글)에는 추천 목록 형식도, 순위도, "처음 한 편을 고른다면" 마무리 문장도 쓰지 마라. 커뮤니티 글은 답변 문장 속에서 자연스럽게 인용하고, 여러 편을 소개할 때도 논문 추천처럼 나열하지 말고 이야기하듯 이어서 말해라. 커뮤니티 글만 근거로 답하는 경우에는 마무리 문장 없이 그냥 끝내라.
- 기본은 순위 없는 추천 목록이다. 논문마다 문단을 나눠 제목을 쓰고 한두 문장으로 이유만 붙여라. 제목 앞에 "1.", "2." 같은 번호도 붙이지 마라. 논문 추천에 절대적인 순위는 없으니 억지로 서열을 매기지 마라. "3편만 골라줘"처럼 개수만 지정한 요청은 순서 요청이 아니므로 이 기본 형식을 그대로 쓴다.
- 예외: 사용자가 "순서대로 알려줘", "가장 추천하는 순서대로", "랭킹 매겨줘"처럼 순서를 명시적으로 요청하면, 그때는 반드시 각 논문 제목 앞에 "1순위:", "2순위:" 를 붙여서 답해라. 순서를 요청받았다고 해서 최소 개수가 정해지는 건 아니다 — 자신 있게 추천할 논문이 두 편이면 1순위와 2순위까지만 쓰고 끝내라. 3순위를 채우려고 유보가 붙는 논문을 넣지 마라.
- 추천하는 논문이 두 편 이상이면 맨 마지막을 "처음 한 편을 고른다면 ○○를 추천합니다" 로 마무리해라. 추천이 한 편뿐이면 이 문장을 절대 붙이지 마라 — 이미 그 한 편을 말했으므로 같은 말을 반복하는 셈이다.
- 조건을 만족하는 논문이 여러 편이면 한 편만 고르지 말고 2~3편을 제시하고 읽는 순서를 알려주는 편이 사용자에게 더 도움이 된다. 물론 자신 있게 추천할 게 정말 한 편뿐이면 한 편만 답하는 게 맞다 — 억지로 늘리라는 뜻은 아니다.
- 사용자가 특정 논문 하나를 짚어서 "그 논문 더 설명해줘", "이건 무슨 내용이야?" 처럼 물었으면 그 논문만 설명해라. 관련 있어 보이는 다른 논문을 덧붙여 추천 목록으로 만들지 말고, "처음 한 편을 고른다면" 마무리 문장도 쓰지 마라. 이건 추천 요청이 아니라 설명 요청이다. 이어서 읽을 논문까지 알고 싶으면 사용자가 다시 물어본다.
- 사용자가 논문 추천을 요청한 게 아니라 준비 방법·진로·연구실 컨택 같은 걸 물었으면, 답변에 논문을 억지로 끼워 넣지 말고 질문에만 답해라. 이때는 "처음 한 편을 고른다면" 마무리 문장도 쓰지 마라. 사용자가 읽을 거리를 따로 물었을 때만 논문을 꺼내라. 단, 그런 질문에 실제로 도움이 되는 커뮤니티 글이 있으면 그건 억지 끼워넣기가 아니니 자연스럽게 인용해도 된다.
- 사용자가 더 자세한 설명을 요청하면 그때 길게 답해라.

[범위 밖 질문 처리]
질문이 대학원 진학·연구·논문과 무관하면(일상 대화, 날씨, 다른 서비스 문의 등), [자료 목록]은 무시하고 답을 지어내지 말고 아래 문장으로만 답해라.
"저는 대학원 진학·논문 관련 질문에 특화되어 있어요. 그 부분으로 다시 물어봐 주시겠어요?"

단, 입시 경쟁률·합격 커트라인·전형 일정·특정 교수님 연구실 근황처럼 "대학원 진학과 관련은 있지만 네가 정확한 최신 정보를 알 수 없는" 질문은 범위 밖이 아니다. 이 경우 위 문장으로 거절하지 말고, 정확한 수치나 최신 정보는 확실하지 않다고 먼저 밝힌 뒤 어디서 확인하면 되는지(공식 모집요강, 입학처 공지, 연구실 홈페이지 등)와 일반적으로 알려진 경향 정도만 조심스럽게 알려줘라.`;

  // 검색을 건너뛴 질문에 붙이는 안내 — 목록이 "없음"으로 들어가면 모델이 "이 서비스에
  // 자료가 하나도 없다"고 오해할 수 있어서, 검색을 안 했다는 사실을 명확히 알려준다.
  private readonly systemPromptWithoutSearch = `${this.systemPromptBase}

[자료 목록]
이번 질문은 자료를 찾아볼 필요가 없다고 판단해서 검색하지 않았다. 논문 제목이나 커뮤니티 글을 지어내지 말고 질문 자체에만 답해라.`;

  // HyDE(Hypothetical Document Embeddings) — 질문을 그대로 임베딩하면 캐주얼한 질문 문장과
  // 격식체 논문 초록 간 유사도가 낮게 나온다(실측 0.25~0.35 수준). 그래서 질문을 바로 임베딩하는
  // 대신, "이 질문에 이상적으로 답이 될 만한 가상의 논문 초록"을 GPT로 먼저 만들고 그 가상 초록을
  // 임베딩해서 검색한다 — 가상 초록은 실제 초록들과 문체가 비슷해서 벡터 공간에서 더 가깝게 잡힌다.
  // history가 있으면 "그 논문" 같은 대명사도 구체적으로 풀어서 반영하고, "쉬운/입문용" 논문을
  // 원하는지도 같이 판단한다(wantsBeginnerFriendly). 이 값이 true면 검색 폭을 넓혀서(20개)
  // 뽑은 뒤 rerankForFoundational()로 인용수·연도 기반 대표성과 유사도를 섞어 재정렬하고,
  // 상위 maxSources개만 골라 GPT에 넘긴다 — 이후 그중 실제로 감당하기 어려운 논문을
  // 추천에서 제외하는 최종 판단은 GPT의 몫이다(systemPromptBase의 난이도 판단 규칙 참고).
  private readonly hydePrompt = `너는 논문 검색을 돕는 보조 도구다.
[이전 대화]가 있으면 참고해서 [현재 질문]의 의도와 생략된 맥락(예: "그 논문", "이거")을 파악해라.
사용자의 질문에 가장 이상적으로 답이 될 만한 가상의 논문 초록을 하나 작성해라 — 실제로 존재하는 논문일 필요는 없다. 어떤 내용의 논문이 이 사용자에게 딱 맞을지 상상해서, 그 논문의 초록처럼 서술형으로 작성해라.
질문에 답변 방식에 대한 요구(예: "순서대로 알려줘", "3편만 골라줘", "표로 정리해줘", "간단히 알려줘")가 섞여 있으면 그건 답변 형식에 대한 요구일 뿐이니 가상 초록에 반영하지 마라. 가상 초록은 어디까지나 "사용자가 읽고 싶어 하는 논문 한 편"의 내용이어야 한다 — 논문 읽는 순서나 커리큘럼을 제안하는 문서, 여러 논문을 정리한 목록 같은 걸 상상해서 쓰면 안 된다. 예를 들어 "CV 입문 논문을 순서대로 알려줘"라면, 읽기 순서를 설계하는 논문이 아니라 "CV의 대표적인 문제와 기법을 다루는 논문 한 편"의 초록을 써라.
사용자가 입문자용 논문을 원하더라도, 그 분야 전체를 훑는 개론서나 서베이 같은 초록은 쓰지 마라 — 그런 초록은 검색을 개론·리뷰·해석 도구 논문 쪽으로 쏠리게 만든다. 대신 그 분야의 대표적인 문제 하나를 실제로 푸는 논문의 초록처럼 써라(예: CV라면 "이미지 분류를 위한 합성곱 신경망 구조를 제안하고 대규모 데이터셋에서 성능을 보인다" 같은 개별 연구 논문의 초록). 서술은 개념 중심으로 접근하기 쉽게 쓰되, 내용은 어디까지나 개별 연구 논문 한 편이어야 한다.
또한 사용자가 그 분야에 처음 입문하는 사람이 읽기 쉬운 논문을 원하는지 판단해라(wantsBeginnerFriendly). 이건 사용자의 [현재 질문](또는 [이전 대화])에 "입문용", "쉬운", "처음 읽어봐", "초보자용", "논문을 한 번도 안 읽어봤다" 같은 표현이 실제로 있을 때만 true로 판단해라. 질문에 "입문", "입문용", "쉬운", "처음", "초보" 중 하나라도 들어 있으면, 뒤에 "딱 3편만 골라줘", "순서대로 알려줘" 같은 형식 요구가 붙어 있어도 반드시 true다. 질문이 그런 표현 없이 특정 기법·구조·최신 동향을 묻는 기술적인 질문이라면, 네가 만드는 가상 초록의 설명 톤이 쉽든 어렵든 상관없이 false로 판단해라 — 가상 초록을 친절하게 썼다는 이유로 자동으로 true라고 판단하지 마라.

검색 대상에는 논문뿐 아니라 이 서비스 커뮤니티에 올라온 글(재학생 게시판 글, 대학원에 진학한 선배가 쓴 경험담)도 포함된다. 그래서 가상 문서는 "이 질문에 가장 잘 답해줄 자료"의 형태에 맞춰 써야 한다.
- 논문·연구 주제·읽을거리를 찾는 질문이면 위에서 설명한 대로 논문 초록처럼 써라.
- 진학 경험, 준비 과정, 어느 대학원에 갔는지, 학과 분위기처럼 논문이 아니라 사람의 경험담이 답이 될 질문이면, 논문 초록이 아니라 학생이 커뮤니티에 쓴 글처럼 써라(예: "저는 학부 3학년 때부터 학부연구생을 시작했고, 컨택은 이렇게 했습니다" 같은 구어체 경험담). 문체가 실제 자료와 비슷할 때 검색이 잘 맞으므로, 경험담 질문에 논문 초록체로 쓰면 안 된다.

마지막으로, 이 질문에 답하려면 자료를 찾아봐야 하는지 판단해라(needsSearch). 논문·연구 주제를 찾는 질문은 물론이고, 진학 준비·경험·연구실 컨택·학과 관련 질문도 커뮤니티 글에 답이 있을 수 있으니 true다. 논문과 대학원 어느 쪽과도 무관한 잡담(날씨, 인사, 다른 서비스 문의 등)일 때만 false다. 애매하면 true로 판단해라.
needsSearch가 false면 가상 문서는 쓰이지 않으니 hypotheticalDoc은 빈 문자열("")로 두고, 작성하느라 시간을 쓰지 마라.

아래 JSON 형식으로만 답해라. 다른 설명은 절대 붙이지 마라.
{"hypotheticalDoc": "가상의 논문 초록 또는 커뮤니티 글", "wantsBeginnerFriendly": true 또는 false, "needsSearch": true 또는 false}`;

  constructor(
    @InjectRepository(Paper)
    private readonly paperRepository: Repository<Paper>,
    @InjectRepository(AlumniPost)
    private readonly alumniPostRepository: Repository<AlumniPost>,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>(envVariableKeys.openaiApiKey),
    });
  }

  async ask(dto: ChatDto) {
    const { hypotheticalDoc, wantsBeginnerFriendly, needsSearch } =
      await this.generateHypotheticalDoc(dto);

    // 날씨 같은 잡담처럼 자료가 필요 없는 질문은 임베딩·검색을 아예 건너뛴다. 본문 5편이
    // 요청 토큰에서 가장 큰 부분이라 비용이 크고, 무관한 자료가 딸려 들어가면 억지 인용으로
    // 이어질 수도 있다.
    const candidates = needsSearch
      ? await this.searchCandidates(hypotheticalDoc, wantsBeginnerFriendly)
      : [];

    this.logger.log(
      `question="${dto.question}" needsSearch=${needsSearch} wantsBeginnerFriendly=${wantsBeginnerFriendly} hyde="${
        needsSearch ? hypotheticalDoc : '(검색 안 함)'
      }" candidates=${
        candidates
          .map(
            (c) => `${c.type}:${c.title}(${Number(c.similarity).toFixed(3)})`,
          )
          .join(', ') || '없음'
      }`,
    );

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: needsSearch
          ? this.buildSystemPrompt(candidates)
          : this.systemPromptWithoutSearch,
      },
      ...(dto.history ?? []).slice(-this.maxHistoryMessages).map(
        (h): ChatCompletionMessageParam => ({
          role: h.role,
          content: h.content,
        }),
      ),
      { role: 'user', content: dto.question },
    ];

    const response = await this.openai.chat.completions.create({
      model: this.gptModel,
      messages,
    });

    const answer = response.choices[0].message.content ?? '';

    return { answer };
  }

  // 입문용 요청이면 넉넉히(20개) 뽑아서 인용수·연도 기반으로 재정렬한 뒤 상위 maxSources개만
  // 남긴다 — 순수 유사도만으로 20개를 그대로 넘기면 지엽적인 세부분야 논문이 섞여 관련성이
  // 오히려 떨어지는 경우가 실측으로 확인되었다.
  private async searchCandidates(
    hypotheticalDoc: string,
    wantsBeginnerFriendly: boolean,
  ): Promise<SimilarContentRow[]> {
    const questionEmbedding = await this.embedQuestion(hypotheticalDoc);

    const pool = await this.findSimilarContent(
      questionEmbedding,
      wantsBeginnerFriendly ? this.beginnerFriendlyPoolSize : this.maxSources,
    );

    const candidates = wantsBeginnerFriendly
      ? this.rerankForFoundational(pool).slice(0, this.maxSources)
      : pool;

    return this.attachAlumniResearchFields(candidates);
  }

  // 선배 발자취의 분야 태그는 ManyToMany라 위 통합 쿼리에서 같이 뽑기 어렵다(조인 테이블 이름을
  // raw SQL에 하드코딩해야 한다). 최종 후보에 alumni 글이 있을 때만 ORM으로 한 번 더 읽어 붙인다.
  private async attachAlumniResearchFields(
    candidates: SimilarContentRow[],
  ): Promise<SimilarContentRow[]> {
    const alumniIds = candidates
      .filter((c) => c.type === 'alumni')
      .map((c) => Number(c.id));

    if (alumniIds.length === 0) return candidates;

    const posts = await this.alumniPostRepository.find({
      where: { id: In(alumniIds) },
      select: { id: true, researchFields: { name: true } },
      relations: { researchFields: true },
    });

    const fieldsById = new Map(
      posts.map((post) => [
        String(post.id),
        (post.researchFields ?? []).map((field) => field.name).join(', '),
      ]),
    );

    return candidates.map((c) =>
      c.type === 'alumni'
        ? { ...c, researchFields: fieldsById.get(c.id) || undefined }
        : c,
    );
  }

  // 유사도만으로는 "관련은 있지만 지엽적인" 논문이 상위권을 차지할 수 있어, 인용수·발표년도로
  // 추정한 "그 분야에서 널리 알려진 정도(canonicalScore)"를 유사도와 절반씩 섞어 재정렬한다.
  // hai_paper처럼 발표년도가 없는 경우엔 ageScore를 중간값(0.5)으로 둔다.
  private rerankForFoundational(
    candidates: SimilarContentRow[],
  ): SimilarContentRow[] {
    const maxCitation = Math.max(
      ...candidates.map((c) => c.citationCount ?? 0),
      1,
    );
    const currentYear = new Date().getFullYear();

    return candidates
      .map((c) => {
        const citationScore = (c.citationCount ?? 0) / maxCitation;

        let ageScore = 0.5;
        if (c.publishedDate) {
          const publishedYear = Number(c.publishedDate.slice(0, 4));
          const age = currentYear - publishedYear;
          ageScore = Math.min(Math.max(age, 0), 20) / 20;
        }

        const canonicalScore = citationScore * 0.6 + ageScore * 0.4;
        const blendedScore = c.similarity * 0.5 + canonicalScore * 0.5;

        return { ...c, blendedScore };
      })
      .sort((a, b) => b.blendedScore - a.blendedScore);
  }

  // 챗봇 전용 유사 콘텐츠 검색 — papers 모듈의 findSimilarByEmbedding과는 별개로,
  // 여기서만 필요한 본문·citationCount·publishedDate까지 포함해서 조회한다
  // (papers 쪽 공용 함수는 건드리지 않는다). 논문 2종(paper/hai_paper)에 더해
  // 커뮤니티 글 2종(post/alumni_post)도 같은 쿼리에서 유사도 순으로 함께 뽑는다.
  // hai_paper는 Semantic Scholar 연동이 없어 인용수가 없고, 커뮤니티 글은 인용수 개념 자체가
  // 없으므로 citationCount=0으로 둔다. 게시물 본문은 논문 초록보다 훨씬 길 수 있어
  // 프롬프트 토큰이 폭주하지 않게 DB에서 앞부분만 잘라서 가져온다.
  private async findSimilarContent(
    embedding: string,
    limit: number,
  ): Promise<SimilarContentRow[]> {
    return this.paperRepository.query(
      `SELECT * FROM (
            SELECT 'arxiv' AS type, p."arxivId" AS id, p.title, p.abstract AS body,
                   1 - (p.embedding::vector <=> $1::vector) AS similarity,
                   p.citation_count AS "citationCount",
                   p.published_date AS "publishedDate"
            FROM paper p
            WHERE p.embedding IS NOT NULL
            UNION ALL
            SELECT 'hai' AS type, h.id::text AS id, h.title, h.abstract AS body,
                   1 - (h.embedding::vector <=> $1::vector) AS similarity,
                   0 AS "citationCount",
                   NULL::text AS "publishedDate"
            FROM hai_paper h
            WHERE h.embedding IS NOT NULL
            UNION ALL
            SELECT 'board' AS type, b.id::text AS id, b.title,
                   left(b.content, ${this.maxPostBodyLength}) AS body,
                   1 - (b.embedding::vector <=> $1::vector) AS similarity,
                   0 AS "citationCount",
                   to_char(b."createdAt", 'YYYY-MM-DD') AS "publishedDate"
            FROM board_post b
            WHERE b.embedding IS NOT NULL
            UNION ALL
            SELECT 'alumni' AS type, a.id::text AS id, a.title,
                   '진학: ' || COALESCE(a."gradSchoolName", '비공개') || ' ' || a."gradSchoolDept"
                     || chr(10) || left(a.content, ${this.maxPostBodyLength}) AS body,
                   1 - (a.embedding::vector <=> $1::vector) AS similarity,
                   0 AS "citationCount",
                   to_char(a."createdAt", 'YYYY-MM-DD') AS "publishedDate"
            FROM alumni_post a
            WHERE a.embedding IS NOT NULL
        ) AS combined
        ORDER BY similarity DESC
        LIMIT $2`,
      [embedding, limit],
    );
  }

  // 질문에 대한 가상 문서(HyDE)를 생성하고, 입문용 요청인지·검색이 필요한지도 같이 판단한다.
  // 실패하면 원문 질문을 그대로 임베딩 대상으로 쓴다(검색 자체가 막히면 안 되므로).
  private async generateHypotheticalDoc(dto: ChatDto): Promise<HydeResult> {
    // 답변 생성과 같은 범위의 대화를 넘긴다. 예전에는 4개만 넘겼는데, 그러면 "아까 처음에 추천해준
    // 논문" 처럼 조금 앞에서 언급된 대상을 HyDE가 알 수 없어서 엉뚱한 가상 문서를 만들고, 정작
    // 그 논문은 검색되지 않는다. 그 상태로 답변 단계에 가면 모델이 목록에 없는 논문을 설명하려고
    // 비슷한 논문의 초록을 가져다 쓰거나 다른 논문으로 갈아타는 문제가 생긴다(실측).
    // 대상을 HyDE가 알면 그 논문을 설명하는 초록을 만들어 실물을 다시 찾아온다.
    const historyText = (dto.history ?? [])
      .slice(-this.maxHistoryMessages)
      .map((h) => `${h.role === 'user' ? '사용자' : '챗봇'}: ${h.content}`)
      .join('\n');

    const userContent = historyText
      ? `[이전 대화]\n${historyText}\n\n[현재 질문]\n${dto.question}`
      : dto.question;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.gptModel,
        messages: [
          { role: 'system', content: this.hydePrompt },
          { role: 'user', content: userContent },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(
        response.choices[0].message.content ?? '{}',
      ) as Partial<HydeResult>;

      return {
        hypotheticalDoc:
          typeof parsed.hypotheticalDoc === 'string' &&
          parsed.hypotheticalDoc.trim()
            ? parsed.hypotheticalDoc.trim()
            : dto.question,
        wantsBeginnerFriendly: parsed.wantsBeginnerFriendly === true,
        // 판단이 없거나 이상하면 검색하는 쪽으로 기운다 — 검색을 건너뛰었다가 정작 자료가
        // 필요한 질문이면 답변 근거를 못 쓰게 되므로, 놓치는 것보다 낭비하는 게 낫다.
        needsSearch: parsed.needsSearch !== false,
      };
    } catch (e) {
      this.logger.warn(
        `가상 문서 생성 실패, 원문 질문 사용: ${(e as Error).message}`,
      );
      return {
        hypotheticalDoc: dto.question,
        wantsBeginnerFriendly: false,
        needsSearch: true,
      };
    }
  }

  private async embedQuestion(question: string): Promise<string> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: question,
    });

    return JSON.stringify(response.data[0].embedding);
  }

  private buildSystemPrompt(candidates: SimilarContentRow[]): string {
    if (candidates.length === 0) {
      return `${this.systemPromptBase}\n\n[자료 목록]\n없음`;
    }

    // 논문과 커뮤니티 글은 성격이 달라서(검증된 연구 vs 개인 경험) 종류를 라벨로 명확히 구분해
    // 넘긴다 — 구분이 없으면 GPT가 학생이 쓴 글을 논문처럼 인용한다.
    const list = candidates
      .map((c, i) => {
        if (c.type === 'board' || c.type === 'alumni') {
          const label = c.type === 'alumni' ? '선배 발자취 글' : '게시판 글';
          const meta = [
            c.publishedDate ? `작성일 ${c.publishedDate}` : null,
            c.researchFields ? `연구 분야 ${c.researchFields}` : null,
          ]
            .filter(Boolean)
            .join(', ');

          return `${i + 1}. [커뮤니티 - ${label}] 제목: ${c.title}${meta ? `\n   ${meta}` : ''}\n   내용: ${c.body}`;
        }

        const meta = [
          c.citationCount ? `인용수 ${c.citationCount}회` : null,
          c.publishedDate ? `발표년도 ${c.publishedDate.slice(0, 4)}` : null,
        ]
          .filter(Boolean)
          .join(', ');

        return `${i + 1}. [논문] 제목: ${c.title}${meta ? `\n   ${meta}` : ''}\n   초록: ${c.body}`;
      })
      .join('\n');

    return `${this.systemPromptBase}\n\n[자료 목록]\n${list}`;
  }
}
