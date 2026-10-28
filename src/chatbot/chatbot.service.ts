import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { In, Repository } from 'typeorm';
import { envVariableKeys } from 'src/common/const/env.const';
import { Paper } from 'src/papers/entities/papers.entity';
import { GradInfo } from 'src/grad-info/entities/grad-info.entity';
import {
  GRAD_INFO_LABELS,
  GradInfoCategory,
} from 'src/grad-info/const/grad-info.const';
import { ChatDto } from './dto/chat.dto';

// 검색 대상 한 건. 논문(arxiv/hai)과 진학 정보(gradInfo)를 같은 형태로 다룬다.
// body는 논문이면 초록, 진학 정보면 본문(길면 잘라서 가져온다).
interface SimilarContentRow {
  type: 'arxiv' | 'hai' | 'gradInfo';
  id: string;
  title: string;
  body: string;
  similarity: number;
  citationCount: number;
  publishedDate: string | null;
  researchFields?: string; // 분야 태그(쉼표로 이어붙임) — gradInfo에만 채워진다
  // 아래는 hai(휴먼AI공학전공 논문)에만 채워진다
  lab?: string | null; // 연구실 = 지도교수 연구실(hai_paper.department)
  authors?: string | null; // 저자(simple-json 문자열)
  // 아래는 gradInfo에만 채워진다
  category?: GradInfoCategory; // 선배 사례인지 공식 정보인지 — 답변 규칙이 달라진다
  referenceYear?: number | null; // 정보 기준 연도
  admissionYear?: number | null; // 학부 학번(선배 사례)
  entryYear?: number | null; // 대학원 입학 연도(선배 사례)
}

interface HydeResult {
  hypotheticalDoc: string; // 논문 초록체 또는 진학 정보 문서체 — 질문에 답할 자료의 형태에 맞춘다
  wantsBeginnerFriendly: boolean;
  needsSearch: boolean;
  // "이의철 교수님 연구실 논문" 처럼 특정 교수를 지목했을 때의 교수 이름(없으면 빈 문자열).
  // 유사도 상위 몇 건만 뽑는 일반 검색으로는 그 연구실 논문을 다 모을 수 없어서,
  // 이 값이 있으면 연구실로 직접 걸러서 찾는다.
  labName: string;
  // 분야·기간을 지목한 질문("2025년 CV 논문", "최근 3개월 HCI 논문")을 위한 조건.
  // 유사도만으로는 "그 분야", "그 기간"을 보장할 수 없어서 DB에서 직접 거른다.
  fieldTag: string; // arXiv 분야 코드(cs.CV 등). 없으면 빈 문자열
  dateFrom: string; // YYYY-MM-DD. 없으면 빈 문자열
  dateTo: string; // YYYY-MM-DD. 없으면 빈 문자열
  wantsRecent: boolean; // "최신", "최근"처럼 기간을 못 박지 않고 최근 논문을 원하는 경우
}

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private readonly openai: OpenAI;
  private readonly gptModel = 'gpt-5.4-mini'; // ai-services와 동일한 모델
  private readonly embeddingModel = 'text-embedding-3-large';
  private readonly maxSources = 5;
  // 특정 교수 연구실을 지목한 질문은 그 연구실 논문을 최대한 모아서 넘긴다("모두 알려줘" 대응).
  private readonly maxLabPapers = 10;
  // 분야·기간을 지목한 질문도 "모두 나열해줘"가 많아 일반 검색보다 넉넉히 넘긴다.
  // 본문(초록)이 함께 들어가므로 무작정 늘리면 요청 토큰과 비용이 커진다.
  private readonly maxFilteredPapers = 10;
  // 입문용 요청일 때는 넉넉히 뽑은 뒤 rerankForFoundational()로 재정렬해서 상위 maxSources개만 쓴다.
  private readonly beginnerFriendlyPoolSize = 20;
  // 대화를 저장하지 않고 프론트가 history를 매번 보내는 구조라, 길이 제한이 없으면 대화가 길어질수록
  // 요청 토큰(=비용)이 무한정 늘어난다. 최근 대화만 남겨서 상한을 둔다.
  private readonly maxHistoryMessages = 10;
  // 진학 정보 본문은 길이 제한이 없어서, 프롬프트에 넣을 만큼만 잘라서 조회한다.
  private readonly maxGradInfoBodyLength = 800;

  // 캐주얼한 질문 문장과 논문 제목+초록(격식체) 간 코사인 유사도는 절대값이 낮게 나오고,
  // 관련 있는 논문과 없는 논문의 점수 차이도 크지 않아(실측: 관련 논문 0.264 vs 무관 논문 0.25)
  // 고정 임계값으로는 "관련 있음/없음"을 안정적으로 못 가른다. 그래서 점수로 거르지 않고
  // 상위 후보를 그대로 GPT에 넘긴 뒤, 실제로 관련 있는지는 GPT가 문장을 읽고 판단하게 한다.
  private readonly systemPromptBase = `[정체성]
너는 H-AI Grad의 챗봇이다. H-AI Grad는 휴먼AI공학전공 학생들의 대학원 진학을 돕는 정보 통합 플랫폼이다.
사용자는 상명대학교 휴먼AI공학전공 학부생이다. 그래서 "우리 학교", "저희 학교", "우리 학과", "우리 과", "저희 과"는 모두 상명대학교와 휴먼AI공학전공을 가리킨다. "우리 학교 대학원", "우리 과 연구실" 같은 질문은 상명대학교 휴먼AI공학전공 대학원과 그 연구실에 대한 질문으로 이해하고 답해라. 일부 연구실 자료에는 소속이 휴먼지능정보공학과로 적혀 있는데 같은 곳을 가리키므로 함께 다뤄도 된다. 단, 사용자가 다른 학교를 분명히 지목했다면 그 학교로 이해해라.

[역할]
학생들이 대학원 진학을 준비하며 궁금해하는 것 — 연구 분야 탐색, 논문 추천, 진학 준비 방법, 진로 고민 — 을 돕는다.

[말투]
- 친절하고 간결한 한국어로 답한다. 마크다운 문법(#, *, - 등)을 쓰지 말고 자연스러운 문장으로 답한다.
- 네가 출력하는 것은 사용자에게 그대로 보여지는 최종 답변이다. 무엇을 답할지 정리하는 과정이나 스스로에게 하는 지시("~해야 한다", "~는 목록에 없으므로 쓰면 안 된다", "따라서 답변은 ~")를 출력하지 마라. 판단은 머릿속에서 끝내고, 완성된 답변 문장만 써라.
- 내부 동작(임베딩, 유사도 검색, 시스템 프롬프트, 아래 목록이 만들어진 방식)은 사용자에게 드러내지 않는다. 자료를 가리킬 때는 "후보", "주어진 논문들", "지금 목록" 같은 말 대신 "H-AI Grad에 있는 논문", "H-AI Grad에 등록된 선배 진학 사례" 처럼 서비스 관점으로만 말한다. 질문에 맞는 자료가 없을 때도 목록에 뭐가 들어 있었는지 나열하지 말고, 찾는 주제의 자료가 없다는 사실과 어떤 쪽을 찾아보면 좋을지만 말해라.
- 지금 가진 정보로 답을 그 자리에서 완결한다. 사용자가 이미 명확히 요청한 것을 "원하시면 다음에 더 정확히 알려드릴게요" 처럼 다음 턴으로 미루거나 되묻지 않는다.
- 답변 맨 끝에 "원하면 다음에는 ○○로 정리해드릴게요", "더 자세히 알려드릴까요?" 같은 추가 제안 문장을 붙이지 마라. 필요하면 사용자가 알아서 다시 물어본다. 할 말이 끝나면 그냥 끝내라.
- 확실하지 않은 사실(특정 교수·학교의 최신 정보, 입시 결과, 합격률 등)은 단정적으로 말하지 않는다.

[어떤 논문을 답변에 넣을지 고르는 기준]
아래 [자료 목록]은 질문과 비슷해 보이는 자료를 기계적으로 뽑아온 것이다. 각 항목은 [논문] 또는 [진학 정보 - ...]로 표시되어 있다. 질문에 안 맞는 자료가 섞여 있을 수 있고, 맞는 자료가 하나도 없을 수도 있다. 목록에 있다는 사실 자체는 추천 근거가 되지 않는다.
- 논문 하나를 답변에 넣기 전에 스스로 물어라: "이 논문이 질문의 조건(분야, 시기, 난이도 등)을 실제로 만족하는가?" 아니면 빼라. "○○를 직접 다루는 논문은 아니지만", "순수한 ○○라기보다는", "가장 중심이 되는 편은 아니지만" 처럼 조건에 안 맞는다는 걸 스스로 인정하는 단서가 붙는다면, 그건 애초에 답변에 넣으면 안 되는 논문이다.
- 반대로, 조건을 만족하는 논문들 사이에서 읽는 순서나 필요한 선행 지식을 알려주는 건 좋다(예: "VGG로 기본 흐름을 본 뒤 읽으면 더 잘 읽힌다"). 이건 유보가 아니라 사용자에게 유용한 안내다.
- 질문에 조건이 있으면(예: "CV", "Transformer 이후에 나온", "입문용") 그 조건을 실제로 만족하는 논문만 넣어라. 분야가 지정된 질문에 그 분야를 직접 다루지 않는 논문(예: CV 질문에 일반 머신러닝 개론이나 드롭아웃·정규화 같은 범용 학습 기법 논문)은 "기초를 다지기 좋다"는 이유로도 넣지 마라.
- 자신 있게 추천할 논문이 한 편이면 한 편만 답해라. 하나도 없으면 H-AI Grad에 있는 논문 중에는 마땅한 게 없다고 솔직히 말한 뒤, 어떤 쪽을 찾아보면 좋을지 방향만 짧게 알려줘라. 개수를 채우려고 애매한 논문을 넣지 마라.
- 아래 [자료 목록]은 이번 질문에 대해 뽑힌 일부일 뿐, H-AI Grad가 가진 자료 전체가 아니다. 목록에 뜬 주제들을 근거로 "이 서비스는 ○○ 위주다" 처럼 서비스 전체의 성격을 단정하지 마라.
- 사용자가 알 만한 유명 논문을 일부러 뺐다면, 추천 목록과 섞지 말고 맨 마지막에 한두 문장으로 "중요한 논문이지만 지금 단계에서는 권하지 않는다"고만 짧게 언급할 수 있다.
- 목록에 없는 논문 제목이나 진학 정보 제목을 지어내지 마라.
- 단, 이전 대화에서 이미 언급된 논문·자료는 예외다. [자료 목록]은 이번 질문으로 새로 검색한 결과일 뿐이라, 직전에 네가 추천했던 논문이 이번 목록에는 없을 수 있다. 그건 이번 검색이 못 찾은 것이지 그 논문이 없다는 뜻이 아니다. 사용자가 그 논문을 다시 물으면 "없다"거나 "이전 답변이 잘못됐다"고 하지 말고, 네가 알고 있는 범위에서 설명해라. 다만 지금 그 논문의 초록을 보고 있는 게 아니므로 실험 수치나 세부 결과까지 지어내지는 마라. 이때 "초록과 주제를 기준으로 보면" 같은 표현은 쓰지 마라 — 초록을 보고 있지 않으면서 초록을 근거로 든 것처럼 말하는 셈이다. 대신 "널리 알려진 바로는", "제가 아는 범위에서는" 처럼 근거가 무엇인지 정확히 밝혀라.

[진학 정보 사용 규칙]
[자료 목록]에는 논문뿐 아니라 H-AI Grad에 등록된 대학원 진학 정보도 섞여 있다. 각 항목은 [진학 정보 - 선배 진학 사례], [진학 정보 - 입시 정보] 처럼 종류가 표시되어 있다.
- 진학 경험, 준비 과정, 어느 대학원으로 갔는지, 입시 일정, 지원 제도처럼 논문에는 없는 정보는 진학 정보가 가장 좋은 근거다. 질문과 직접 맞는 자료가 목록에 있으면 반드시 그 내용을 근거로 답해라 — 네 일반 지식만으로 답하고 그 자료를 그냥 지나치지 마라.
- 자료에 실제로 적힌 내용만 말해라. 자료에 없는 학교·이름·연도·수치·일정을 지어내지 마라. 링크(URL)는 어떤 경우에도 만들어내지 마라.
- DB에 있는 내용과 너의 일반 지식을 문장에서 구분해라. "H-AI Grad에 등록된 선배 사례를 보면", "일반적으로는" 처럼 근거가 무엇인지 드러나게 말해라.
- 자료에 "기준 연도"가 적혀 있으면 답변에 그 연도를 밝혀라(예: "2026년 기준으로는"). 입시 일정·전형·지원 제도는 해마다 바뀌므로, 연도를 밝힌 뒤 학교 공식 모집요강이나 해당 기관 안내에서 최신 내용을 확인하라고 덧붙여라.
- [선배 진학 사례]는 개인의 경험이다. 학번·진학 연도·학교를 함께 밝히고, 한 사람의 경험을 전체 경향이나 일반적인 규칙처럼 단정하지 마라. 사례가 한두 건뿐이면 그 한계를 솔직히 말해라.
- [대학원 정보]에서 특정 연구실이나 교수의 평판·수준을 평가하지 마라. 자료에 적힌 연구 분야와 과정 소개만 전해라.
- [지원 제도 정보](장학금·인건비·병역)는 틀리면 피해가 크다. 자료에 적힌 범위만 요약하고, 개인 상황에 따라 다르니 공식 기관 안내를 확인하라고 반드시 덧붙여라.
- "○○한 선배 있어?", "이런 정보 있어?" 처럼 H-AI Grad에 실제로 어떤 자료가 있는지를 묻는 질문인데 해당하는 자료가 목록에 하나도 없으면, 일반적인 조언으로 넘어가기 전에 "아직 그런 자료는 등록되어 있지 않다"고 먼저 분명히 밝혀라. 이걸 밝히지 않고 네 일반 지식으로만 답하면, 사용자는 그런 자료가 있다고 오해한다. 밝힌 뒤에 도움이 될 만한 일반적인 이야기를 덧붙이는 건 좋다.
- 단, 관련 자료가 일부라도 있으면 "없다"고 말하지 마라. 예를 들어 "선배들은 어디로 많이 가?" 처럼 전체 경향을 묻는 질문에 개별 진학 사례만 있다면, 없다고 하지 말고 있는 사례를 그대로 소개한 뒤 "등록된 사례가 몇 건뿐이라 전체 경향이라고 하기는 어렵다"고 한계를 밝혀라. 없다고 해놓고 곧바로 그 사례를 인용하는 모순된 답변은 절대 하지 마라.
- 논문과 진학 정보를 함께 언급할 때는 어느 쪽이 논문이고 어느 쪽이 진학 정보인지 분명히 구분해서 말해라. 진학 정보를 논문처럼 소개하지 마라.
- 진학 정보는 아래 [답변 형식]의 논문 추천 형식(추천 목록, "처음 한 편을 고른다면")을 따르지 않는다. 답변 문장 속에서 자연스럽게 녹여서 말해라.
- 자료의 출처나 제목을 "출처:" 처럼 따로 표시하지 마라. 답변 문장 안에서 내용만 전하면 된다.

[분야·기간을 지목한 질문 처리]
사용자가 분야나 기간을 지목하면([자료 목록]이 그 조건으로 걸러져 올 수 있다) 아래를 지켜라.
- 목록에 있는 논문만 소개하고, 조건에 맞는 논문이 하나도 없으면 "그 조건에 맞는 논문은 H-AI Grad에 아직 없다"고 분명히 밝혀라. 조건에서 벗어난 논문을 대신 추천하지 마라.
- 자료에 "발행일 2026-01-14"처럼 날짜가 적혀 있으면 그 날짜가 정확한 발행일이다. 월까지 물었다면 그 날짜를 근거로 답해라. "발표년도"만 적힌 자료는 연도까지만 말할 수 있다.
- "최신"이나 "최근"을 물었다면 목록이 최신순으로 정렬되어 올 수 있다. 이때도 질문 주제와 동떨어진 논문은 빼라.
- 조건에 맞는 논문이 한 편뿐이면 한 편만 소개하고, 억지로 수를 채우지 마라.

[휴먼AI공학전공 논문 사용 규칙]
[자료 목록]에 [휴먼AI공학전공 논문]으로 표시된 항목은 상명대학교 휴먼AI공학전공에서 나온 논문이다(학위논문이나 전공 소속 연구실의 논문).
- "우리 과 논문", "우리 학교 논문", "○○○ 교수님 논문", "○○○ 교수님 연구실 논문" 같은 질문에는 이 항목들을 우선해서 답해라. 외부 논문([논문])으로 대신 답하지 마라.
- 각 항목에는 어느 교수 연구실에서 나온 논문인지(연구실)와 저자가 함께 적혀 있다. 교수님 이름으로 물었다면 그 교수님의 연구실 논문만 골라라. 이름이 다르면 그 교수님 논문이 아니다.
- 지목한 교수님의 논문이 목록에 하나도 없으면 "그 교수님 논문은 지금 등록된 자료에서 찾지 못했다"고 분명히 밝혀라. 다른 교수님 논문을 대신 내놓지 마라.
- 이 논문들은 인용수 정보가 없다. 인용수를 지어내거나 영향력을 단정하지 마라.
- 외부 논문과 함께 소개할 때는 어느 쪽이 우리 전공 논문인지 분명히 구분해서 말해라.

[내용·난이도를 말하는 방법]
- 논문이 다루는 내용(주제, 방법론, 다루는 문제)은 그 논문의 초록에 실제로 적힌 것에만 근거해서 말해라. 초록에 없는 내용을 지어내지 마라.
- 초록은 제목이 정확히 일치하는 항목의 것만 써라. 제목이 비슷하거나 같은 계열이라도 다른 논문이다(예: "Going Deeper with Convolutions"와 "Rethinking the Inception Architecture for Computer Vision"은 서로 다른 논문이다). 어떤 논문이 목록에 없는데 비슷한 논문이 목록에 있다고 해서, 그 비슷한 논문의 초록 내용을 원래 논문의 설명으로 가져다 쓰지 마라 — 이건 사용자가 알아채기 어려운 거짓말이 된다.
- 너는 제목과 초록만 봤고 본문 전체를 읽은 게 아니다. 단정하지 말고 "초록과 주제를 기준으로 보면" 같은 표현으로 근거의 한계를 자연스럽게 밝혀라.
- 난이도는 초록의 문체·개념 추상도와, 네가 이미 알고 있는 그 논문의 일반적인 평판을 함께 보고 판단해라. "리뷰/서베이라서 쉽다", "인용수가 많으니 입문자에게 좋다" 같은 기계적 판단은 하지 마라 — 유명하고 인용이 많은 논문일수록 배경지식이 있는 독자를 전제하고 쓰였을 가능성이 높다.
- 인용수·발표년도는 "영향력"의 근거로만 참고하고, 수치를 지어내지 마라.
- 정말 쉬운 논문이 마땅치 않으면 목록을 꺼내기 전에 그 사실을 한 문장으로 솔직히 밝히고, 그중 그나마 무난한 것들을 제시해라.

[답변 형식]
- 아래 형식 규칙은 전부 "논문을 추천할 때"만 적용된다. 진학 정보에는 추천 목록 형식도, 순위도, "처음 한 편을 고른다면" 마무리 문장도 쓰지 마라. 진학 정보는 답변 문장 속에서 자연스럽게 전하고, 여러 건을 소개할 때도 논문 추천처럼 나열하지 말고 이야기하듯 이어서 말해라. 진학 정보만 근거로 답하는 경우에는 마무리 문장 없이 그냥 끝내라.
- 기본은 순위 없는 추천 목록이다. 논문마다 문단을 나눠 제목을 쓰고 한두 문장으로 이유만 붙여라. 제목 앞에 "1.", "2." 같은 번호도 붙이지 마라. 논문 추천에 절대적인 순위는 없으니 억지로 서열을 매기지 마라. "3편만 골라줘"처럼 개수만 지정한 요청은 순서 요청이 아니므로 이 기본 형식을 그대로 쓴다.
- 예외: 사용자가 "순서대로 알려줘", "가장 추천하는 순서대로", "랭킹 매겨줘"처럼 순서를 명시적으로 요청하면, 그때는 반드시 각 논문 제목 앞에 "1순위:", "2순위:" 를 붙여서 답해라. 순서를 요청받았다고 해서 최소 개수가 정해지는 건 아니다 — 자신 있게 추천할 논문이 두 편이면 1순위와 2순위까지만 쓰고 끝내라. 3순위를 채우려고 유보가 붙는 논문을 넣지 마라.
- 추천하는 논문이 두 편 이상이면 맨 마지막을 "처음 한 편을 고른다면 ○○를 추천합니다" 로 마무리해라. 추천이 한 편뿐이면 이 문장을 절대 붙이지 마라 — 이미 그 한 편을 말했으므로 같은 말을 반복하는 셈이다.
- 조건을 만족하는 논문이 여러 편이면 한 편만 고르지 말고 2~3편을 제시하고 읽는 순서를 알려주는 편이 사용자에게 더 도움이 된다. 물론 자신 있게 추천할 게 정말 한 편뿐이면 한 편만 답하는 게 맞다 — 억지로 늘리라는 뜻은 아니다.
- 사용자가 특정 논문 하나를 짚어서 "그 논문 더 설명해줘", "이건 무슨 내용이야?" 처럼 물었으면 그 논문만 설명해라. 관련 있어 보이는 다른 논문을 덧붙여 추천 목록으로 만들지 말고, "처음 한 편을 고른다면" 마무리 문장도 쓰지 마라. 이건 추천 요청이 아니라 설명 요청이다. 이어서 읽을 논문까지 알고 싶으면 사용자가 다시 물어본다.
- 사용자가 논문 추천을 요청한 게 아니라 준비 방법·진로·연구실 컨택 같은 걸 물었으면, 답변에 논문을 억지로 끼워 넣지 말고 질문에만 답해라. 이때는 "처음 한 편을 고른다면" 마무리 문장도 쓰지 마라. 사용자가 읽을 거리를 따로 물었을 때만 논문을 꺼내라. 단, 그런 질문에 실제로 도움이 되는 진학 정보가 있으면 그건 억지 끼워넣기가 아니니 자연스럽게 전해도 된다.
- 사용자가 더 자세한 설명을 요청하면 그때 길게 답해라.

[범위 밖 질문 처리]
질문이 대학원 진학·연구·논문과 무관하면(일상 대화, 날씨, 다른 서비스 문의 등), [자료 목록]은 무시하고 답을 지어내지 말고 아래 문장으로만 답해라.
"저는 대학원 진학·논문 관련 질문에 특화되어 있어요. 그 부분으로 다시 물어봐 주시겠어요?"

단, 입시 경쟁률·합격 커트라인·전형 일정·특정 교수님 연구실 근황처럼 "대학원 진학과 관련은 있지만 네가 정확한 최신 정보를 알 수 없는" 질문은 범위 밖이 아니다. 이 경우 위 문장으로 거절하지 말고, 정확한 수치나 최신 정보는 확실하지 않다고 먼저 밝힌 뒤 어디서 확인하면 되는지(공식 모집요강, 입학처 공지, 연구실 홈페이지 등)와 일반적으로 알려진 경향 정도만 조심스럽게 알려줘라.`;

  // 검색을 건너뛰었거나(잡담) 검색이 실패한 질문에 붙이는 안내 — 목록이 "없음"으로 들어가면
  // 모델이 "이 서비스에 자료가 하나도 없다"고 오해할 수 있어서, 자료가 제공되지 않았다는
  // 사실만 알려준다.
  private readonly systemPromptWithoutSearch = `${this.systemPromptBase}

[자료 목록]
이번 질문에는 참고할 자료가 제공되지 않았다. 논문 제목이나 진학 정보를 지어내지 말고 질문 자체에만 답해라. 자료가 없다는 내부 사정을 사용자에게 설명할 필요는 없다.`;

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
사용자는 상명대학교 휴먼AI공학전공 학부생이다. 질문에 "우리 학교", "우리 과", "저희 학교" 같은 표현이 있으면 상명대학교 휴먼AI공학전공을 가리키므로, 가상 문서에도 그 학교와 전공 이름을 풀어서 써라(그래야 해당 자료가 검색된다).
사용자의 질문에 가장 이상적으로 답이 될 만한 가상의 논문 초록을 하나 작성해라 — 실제로 존재하는 논문일 필요는 없다. 어떤 내용의 논문이 이 사용자에게 딱 맞을지 상상해서, 그 논문의 초록처럼 서술형으로 작성해라.
질문에 답변 방식에 대한 요구(예: "순서대로 알려줘", "3편만 골라줘", "표로 정리해줘", "간단히 알려줘")가 섞여 있으면 그건 답변 형식에 대한 요구일 뿐이니 가상 초록에 반영하지 마라. 가상 초록은 어디까지나 "사용자가 읽고 싶어 하는 논문 한 편"의 내용이어야 한다 — 논문 읽는 순서나 커리큘럼을 제안하는 문서, 여러 논문을 정리한 목록 같은 걸 상상해서 쓰면 안 된다. 예를 들어 "CV 입문 논문을 순서대로 알려줘"라면, 읽기 순서를 설계하는 논문이 아니라 "CV의 대표적인 문제와 기법을 다루는 논문 한 편"의 초록을 써라.
사용자가 입문자용 논문을 원하더라도, 그 분야 전체를 훑는 개론서나 서베이 같은 초록은 쓰지 마라 — 그런 초록은 검색을 개론·리뷰·해석 도구 논문 쪽으로 쏠리게 만든다. 대신 그 분야의 대표적인 문제 하나를 실제로 푸는 논문의 초록처럼 써라(예: CV라면 "이미지 분류를 위한 합성곱 신경망 구조를 제안하고 대규모 데이터셋에서 성능을 보인다" 같은 개별 연구 논문의 초록). 서술은 개념 중심으로 접근하기 쉽게 쓰되, 내용은 어디까지나 개별 연구 논문 한 편이어야 한다.
또한 사용자가 그 분야에 처음 입문하는 사람이 읽기 쉬운 논문을 원하는지 판단해라(wantsBeginnerFriendly). 이건 사용자의 [현재 질문](또는 [이전 대화])에 "입문용", "쉬운", "처음 읽어봐", "초보자용", "논문을 한 번도 안 읽어봤다" 같은 표현이 실제로 있을 때만 true로 판단해라. 질문에 "입문", "입문용", "쉬운", "처음", "초보" 중 하나라도 들어 있으면, 뒤에 "딱 3편만 골라줘", "순서대로 알려줘" 같은 형식 요구가 붙어 있어도 반드시 true다. 질문이 그런 표현 없이 특정 기법·구조·최신 동향을 묻는 기술적인 질문이라면, 네가 만드는 가상 초록의 설명 톤이 쉽든 어렵든 상관없이 false로 판단해라 — 가상 초록을 친절하게 썼다는 이유로 자동으로 true라고 판단하지 마라.

검색 대상에는 논문뿐 아니라 이 서비스에 등록된 대학원 진학 정보(선배 진학 사례, 입시 일정·전형, 컨택·준비 방법, 대학원 소개, 장학금·병역 같은 지원 제도)도 포함된다. 그래서 가상 문서는 "이 질문에 가장 잘 답해줄 자료"의 형태에 맞춰 써야 한다.
- 논문·연구 주제·읽을거리를 찾는 질문이면 위에서 설명한 대로 논문 초록처럼 써라.
- 진학 경험, 준비 과정, 어느 대학원에 갔는지, 입시 일정, 지원 제도처럼 논문이 아니라 진학 자료가 답이 될 질문이면, 논문 초록이 아니라 그 진학 정보 문서처럼 써라. 선배 사례를 찾는 질문이면 경험담처럼("저는 학부 3학년 때부터 학부연구생을 시작했고, 컨택은 이렇게 했습니다"), 입시나 제도를 찾는 질문이면 안내문처럼("전기 모집 원서 접수는 9월 중순이며 면접은 10월 말에 진행된다") 쓰면 된다. 문체가 실제 자료와 비슷할 때 검색이 잘 맞으므로, 이런 질문에 논문 초록체로 쓰면 안 된다.

마지막으로, 이 질문에 답하려면 자료를 찾아봐야 하는지 판단해라(needsSearch). 논문·연구 주제를 찾는 질문은 물론이고, 진학 준비·경험·입시·연구실 컨택·지원 제도 관련 질문도 등록된 진학 정보에 답이 있을 수 있으니 true다. 논문과 대학원 어느 쪽과도 무관한 잡담(날씨, 인사, 다른 서비스 문의 등)일 때만 false다. 애매하면 true로 판단해라.
질문이 분야나 기간을 지목하고 있으면 아래 값들도 채워라. user message에 오늘 날짜가 주어지므로 "최근 3개월", "올해" 같은 표현은 그 날짜를 기준으로 계산해라.
- fieldTag: 질문이 특정 연구 분야를 지목하면 해당 arXiv 분야 코드를 담는다. 쓸 수 있는 값은 cs.CV(컴퓨터비전), cs.CL(자연어처리), cs.LG(기계학습·딥러닝·강화학습), cs.RO(로보틱스), cs.IR(정보검색·추천), cs.SD(음성·오디오), cs.HC(HCI·인간컴퓨터상호작용), cs.MM(멀티모달), cs.SE(소프트웨어공학·코드), stat.ML(통계적 기계학습) 뿐이다. 해당하는 분야가 없거나 분야를 지목하지 않았으면 빈 문자열("")로 둔다. 특정 기법(예: 트랜스포머, 디퓨전)을 물은 것이지 분야를 지목한 게 아니라면 빈 문자열로 둔다.
- dateFrom, dateTo: 기간이 분명하면 YYYY-MM-DD 형식으로 채운다. 예를 들어 "2025년에 나온"은 dateFrom 2025-01-01, dateTo 2025-12-31이고 "2026년 1월에 나온"은 2026-01-01과 2026-01-31이다. "최근 3개월"은 오늘 날짜에서 3개월 전부터 오늘까지다. 기간을 말하지 않았으면 둘 다 빈 문자열("")로 둔다.
- wantsRecent: "최신", "최근에 나온", "요즘" 처럼 기간을 못 박지 않고 최근 논문을 원하면 true, 아니면 false다. dateFrom과 dateTo를 채웠다면 wantsRecent는 false로 둔다.

질문이 특정 교수의 연구실 논문을 묻고 있으면(예: "이의철 교수님 연구실 논문 알려줘", "김동근 교수님 논문 추천해줘", "우리 과 권지은 교수님 연구는?") 그 교수의 이름만 labName에 담아라(예: "이의철"). 교수 이름이 없거나 특정 교수를 지목하지 않은 질문이면 빈 문자열("")로 둬라. 직함(교수님, 교수), 연구실, 랩 같은 말은 빼고 사람 이름만 담는다.

needsSearch가 false면 가상 문서는 쓰이지 않으니 hypotheticalDoc은 빈 문자열("")로 두고, 작성하느라 시간을 쓰지 마라.

아래 JSON 형식으로만 답해라. 다른 설명은 절대 붙이지 마라.
{"hypotheticalDoc": "가상의 논문 초록 또는 진학 정보 문서", "wantsBeginnerFriendly": true 또는 false, "needsSearch": true 또는 false, "labName": "교수 이름 또는 빈 문자열", "fieldTag": "분야 코드 또는 빈 문자열", "dateFrom": "YYYY-MM-DD 또는 빈 문자열", "dateTo": "YYYY-MM-DD 또는 빈 문자열", "wantsRecent": true 또는 false}`;

  constructor(
    @InjectRepository(Paper)
    private readonly paperRepository: Repository<Paper>,
    @InjectRepository(GradInfo)
    private readonly gradInfoRepository: Repository<GradInfo>,
    private readonly configService: ConfigService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>(envVariableKeys.openaiApiKey),
    });
  }

  async ask(dto: ChatDto) {
    const hyde = await this.generateHypotheticalDoc(dto);
    const { hypotheticalDoc, wantsBeginnerFriendly, needsSearch, labName } = hyde;

    // 날씨 같은 잡담처럼 자료가 필요 없는 질문은 임베딩·검색을 아예 건너뛴다. 본문 5편이
    // 요청 토큰에서 가장 큰 부분이라 비용이 크고, 무관한 자료가 딸려 들어가면 억지 인용으로
    // 이어질 수도 있다.
    // 검색이 실패해도(임베딩 API 오류, DB 일시 장애) 대화를 끊지 않는다. 진학 상담처럼 자료
    // 없이도 답할 수 있는 질문이 많으므로, 자료 없는 경로로 떨어뜨려 답변은 내보낸다.
    let candidates: SimilarContentRow[] = [];
    let searchNote = ''; // 조건 검색일 때 "총 몇 편 중 몇 편" 같은 안내
    let searched = needsSearch;

    if (needsSearch) {
      try {
        const result = await this.searchCandidates(hyde);
        candidates = result.candidates;
        searchNote = result.note;
      } catch (e) {
        this.logger.warn(
          `자료 검색 실패, 자료 없이 답변합니다: ${(e as Error).message}`,
        );
        searched = false;
      }
    }

    this.logger.log(
      `question="${dto.question}" needsSearch=${needsSearch} wantsBeginnerFriendly=${wantsBeginnerFriendly} labName="${labName}" filter="${hyde.fieldTag || '-'} ${hyde.dateFrom || '-'}~${hyde.dateTo || '-'}${hyde.wantsRecent ? ' 최신' : ''}" hyde="${
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
        content: searched
          ? this.buildSystemPrompt(candidates, searchNote)
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
    hyde: HydeResult,
  ): Promise<{ candidates: SimilarContentRow[]; note: string }> {
    const { hypotheticalDoc, wantsBeginnerFriendly, labName } = hyde;
    const questionEmbedding = await this.embedQuestion(hypotheticalDoc);

    // "2025년에 나온 CV 논문", "최근 3개월 HCI 논문" 처럼 분야나 기간을 못 박은 질문은
    // 유사도 상위 몇 건만 봐서는 조건을 지킬 수 없다(그 조건에 맞는 논문이 상위에 없을 수 있다).
    // 그래서 DB에서 직접 걸러서 찾는다. 분야·발행일이 모두 있는 arXiv 논문(paper)만 대상이다.
    if (hyde.fieldTag || hyde.dateFrom || hyde.dateTo || hyde.wantsRecent) {
      const { rows, total } = await this.findPapersByFilter(questionEmbedding, hyde);

      if (rows.length > 0) {
        // 조건에 맞는 논문이 넘겨준 수보다 많을 수 있다. 그 사실을 GPT에게 알려줘야
        // "모두 나열해줘" 같은 질문에 몇 편 중 몇 편을 보여주는지 정확히 말할 수 있다.
        const note =
          total > rows.length
            ? `조건에 맞는 논문은 모두 ${total}편이고, 그중 ${rows.length}편을 아래에 보여준다.`
            : `조건에 맞는 논문은 아래 ${rows.length}편이 전부다.`;

        return { candidates: rows, note };
      }
      // 조건에 맞는 논문이 없으면 일반 검색으로 떨어뜨린다.
      // (조건에 맞는 게 없다는 사실은 GPT가 목록을 보고 판단해 답한다)
    }

    // "○○ 교수님 연구실 논문 다 알려줘" 같은 질문은 유사도 상위 몇 건만 보면 답할 수 없다.
    // 그 연구실 논문이 5편이어도 상위 5건에 한 편만 들어오면 한 편만 소개하게 된다.
    // 그래서 교수를 지목한 질문은 연구실로 직접 걸러서 모은다.
    if (labName) {
      const labPapers = await this.findPapersByLab(
        questionEmbedding,
        labName,
        this.maxLabPapers,
      );

      if (labPapers.length > 0) {
        return { candidates: labPapers, note: '' };
      }
      // 그 이름의 연구실 논문이 없으면 일반 검색으로 떨어뜨린다.
      // (없다는 사실은 GPT가 목록을 보고 판단해 답한다)
    }

    const pool = await this.findSimilarContent(
      questionEmbedding,
      wantsBeginnerFriendly ? this.beginnerFriendlyPoolSize : this.maxSources,
    );

    const candidates = wantsBeginnerFriendly
      ? this.rerankForFoundational(pool).slice(0, this.maxSources)
      : pool;

    return { candidates: await this.attachGradInfoResearchFields(candidates), note: '' };
  }

  // 분야·기간 조건으로 arXiv 논문을 직접 걸러서 돌려준다.
  // - 기간을 못 박았으면 그 기간 안에서 유사도 순
  // - "최신"처럼 기간을 안 박았으면 발행일 최신순(그래야 "최신 CV 논문"이 실제로 최신이 된다)
  // 분야 조건은 ManyToMany 조인 테이블을 봐야 하는데, 테이블·컬럼 이름을 raw SQL에
  // 하드코딩하면 엔티티가 바뀔 때 조용히 깨지므로 TypeORM 메타데이터에서 읽어 쓴다.
  private async findPapersByFilter(
    embedding: string,
    hyde: HydeResult,
  ): Promise<{ rows: SimilarContentRow[]; total: number }> {
    // 조건은 두 쿼리(목록용, 개수용)에서 함께 쓰는데 두 쿼리의 파라미터 번호가 다르다.
    // (목록 쿼리는 $1이 임베딩이라 조건이 $2부터 시작한다)
    // 그래서 시작 번호를 받아 조건문을 만든다.
    const buildConditions = (startIndex: number) => {
      const conditions: string[] = ['p.embedding IS NOT NULL'];
      const values: unknown[] = [];
      const nextIndex = () => startIndex + values.length;

      if (hyde.dateFrom) {
        conditions.push(`p.published_date >= $${nextIndex()}`);
        values.push(hyde.dateFrom);
      }

      if (hyde.dateTo) {
        conditions.push(`p.published_date <= $${nextIndex()}`);
        values.push(hyde.dateTo);
      }

      if (hyde.fieldTag) {
        // 분야는 ManyToMany 조인 테이블을 봐야 한다. 테이블·컬럼 이름을 raw SQL에 하드코딩하면
        // 엔티티가 바뀔 때 조용히 깨지므로 TypeORM 메타데이터에서 읽어 쓴다.
        const relation =
          this.paperRepository.metadata.findRelationWithPropertyPath('researchFields');

        if (relation?.joinTableName) {
          const joinTable = relation.joinTableName;
          const paperColumn = relation.joinColumns[0].databaseName;
          const fieldColumn = relation.inverseJoinColumns[0].databaseName;
          const index = nextIndex();

          conditions.push(
            `EXISTS (
               SELECT 1 FROM "${joinTable}" jt
               JOIN research_field rf ON rf.id = jt."${fieldColumn}"
               WHERE jt."${paperColumn}" = p."arxivId"
                 AND (rf.name = $${index} OR rf.tag = $${index})
             )`,
          );
          values.push(hyde.fieldTag);
        }
      }

      return { where: conditions.join(' AND '), values };
    };

    // 조건에 맞는 전체 편수(상한과 무관). "모두 나열해줘"에 몇 편인지 말해주기 위한 값이다.
    const countQuery = buildConditions(1);
    const countRows: { count: string }[] = await this.paperRepository.query(
      `SELECT count(*)::text AS count FROM paper p WHERE ${countQuery.where}`,
      countQuery.values,
    );
    const total = Number(countRows[0]?.count ?? 0);

    // 기간을 못 박지 않은 "최신" 요청이면 발행일 순으로, 그 외에는 유사도 순으로 고른다.
    const orderBy =
      hyde.wantsRecent && !hyde.dateFrom && !hyde.dateTo
        ? 'p.published_date DESC'
        : 'similarity DESC';

    const listQuery = buildConditions(2);
    const params = [embedding, ...listQuery.values, this.maxFilteredPapers];

    const rows: SimilarContentRow[] = await this.paperRepository.query(
      `SELECT 'arxiv' AS type, p."arxivId" AS id, p.title, p.abstract AS body,
              1 - (p.embedding::vector <=> $1::vector) AS similarity,
              p.citation_count AS "citationCount",
              p.published_date AS "publishedDate",
              NULL::varchar AS lab,
              NULL::text AS authors,
              NULL::varchar AS category,
              NULL::int AS "referenceYear",
              NULL::int AS "admissionYear",
              NULL::int AS "entryYear"
       FROM paper p
       WHERE ${listQuery.where}
       ORDER BY ${orderBy}
       LIMIT $${params.length}`,
      params,
    );

    return { rows, total };
  }

  // 지목된 교수의 연구실 논문만 모아서 유사도 순으로 돌려준다.
  // hai_paper.department에 "이의철 연구실"처럼 어느 교수 연구실인지가 들어 있다.
  private async findPapersByLab(
    embedding: string,
    labName: string,
    limit: number,
  ): Promise<SimilarContentRow[]> {
    return this.paperRepository.query(
      `SELECT 'hai' AS type, h.id::text AS id, h.title, h.abstract AS body,
              1 - (h.embedding::vector <=> $1::vector) AS similarity,
              0 AS "citationCount",
              h.published_year AS "publishedDate",
              h.department AS lab,
              h.authors::text AS authors,
              NULL::varchar AS category,
              NULL::int AS "referenceYear",
              NULL::int AS "admissionYear",
              NULL::int AS "entryYear"
       FROM hai_paper h
       WHERE h.embedding IS NOT NULL
         AND h.department ILIKE $2
       ORDER BY similarity DESC
       LIMIT $3`,
      [embedding, `%${labName}%`, limit],
    );
  }

  // 진학 정보의 분야 태그는 ManyToMany라 위 통합 쿼리에서 같이 뽑기 어렵다(조인 테이블 이름을
  // raw SQL에 하드코딩해야 한다). 최종 후보에 진학 정보가 있을 때만 ORM으로 한 번 더 읽어 붙인다.
  private async attachGradInfoResearchFields(
    candidates: SimilarContentRow[],
  ): Promise<SimilarContentRow[]> {
    const gradInfoIds = candidates
      .filter((c) => c.type === 'gradInfo')
      .map((c) => Number(c.id));

    if (gradInfoIds.length === 0) return candidates;

    const rows = await this.gradInfoRepository.find({
      where: { id: In(gradInfoIds) },
      select: { id: true, researchFields: { name: true } },
      relations: { researchFields: true },
    });

    const fieldsById = new Map(
      rows.map((row) => [
        String(row.id),
        (row.researchFields ?? []).map((field) => field.name).join(', '),
      ]),
    );

    return candidates.map((c) =>
      c.type === 'gradInfo'
        ? { ...c, researchFields: fieldsById.get(c.id) || undefined }
        : c,
    );
  }

  // 유사도만으로는 "관련은 있지만 지엽적인" 논문이 상위권을 차지할 수 있어, 인용수·발표년도로
  // 추정한 "그 분야에서 널리 알려진 정도(canonicalScore)"를 유사도와 절반씩 섞어 재정렬한다.
  // hai_paper처럼 발표년도가 없는 경우엔 ageScore를 중간값(0.5)으로 둔다.
  //
  // 이 보정은 논문에만 적용한다. 진학 정보는 인용수 개념이 없어 canonicalScore가 늘 0에
  // 수렴하는데, 같은 공식을 쓰면 유사도가 절반으로 깎여서 질문과 딱 맞는 자료가 무관한 논문에
  // 밀린다(실측: 유사도 0.611짜리 게시판 글이 0.27짜리 논문에 밀림). 그래서 진학 정보는
  // 유사도를 그대로 점수로 쓰고, 논문끼리만 대표성 보정을 받아 같은 무대에서 경쟁하게 한다.
  private rerankForFoundational(
    candidates: SimilarContentRow[],
  ): SimilarContentRow[] {
    const isPaper = (c: SimilarContentRow) =>
      c.type === 'arxiv' || c.type === 'hai';

    const maxCitation = Math.max(
      ...candidates.filter(isPaper).map((c) => c.citationCount ?? 0),
      1,
    );
    const currentYear = new Date().getFullYear();

    return candidates
      .map((c) => {
        const similarity = Number(c.similarity);

        if (!isPaper(c)) {
          return { ...c, rankScore: similarity };
        }

        const citationScore = (c.citationCount ?? 0) / maxCitation;

        let ageScore = 0.5;
        if (c.publishedDate) {
          const publishedYear = Number(c.publishedDate.slice(0, 4));
          const age = currentYear - publishedYear;
          ageScore = Math.min(Math.max(age, 0), 20) / 20;
        }

        const canonicalScore = citationScore * 0.6 + ageScore * 0.4;

        return { ...c, rankScore: similarity * 0.5 + canonicalScore * 0.5 };
      })
      .sort((a, b) => b.rankScore - a.rankScore);
  }

  // 챗봇 전용 유사 콘텐츠 검색 — papers 모듈의 findSimilarByEmbedding과는 별개로,
  // 여기서만 필요한 본문·citationCount·publishedDate까지 포함해서 조회한다
  // (papers 쪽 공용 함수는 건드리지 않는다). 논문 2종(paper/hai_paper)에 더해
  // 대학원 진학 정보(grad_info)도 같은 쿼리에서 유사도 순으로 함께 뽑는다.
  // hai_paper는 Semantic Scholar 연동이 없어 인용수가 없고, 진학 정보는 인용수 개념 자체가
  // 없으므로 citationCount=0으로 둔다. 진학 정보 본문은 논문 초록보다 길 수 있어
  // 프롬프트 토큰이 폭주하지 않게 DB에서 앞부분만 잘라서 가져온다.
  // isPublished=false인 진학 정보는 관리자가 답변에서 빼둔 자료이므로 검색 대상에서 제외한다.
  private async findSimilarContent(
    embedding: string,
    limit: number,
  ): Promise<SimilarContentRow[]> {
    return this.paperRepository.query(
      `SELECT * FROM (
            SELECT 'arxiv' AS type, p."arxivId" AS id, p.title, p.abstract AS body,
                   1 - (p.embedding::vector <=> $1::vector) AS similarity,
                   p.citation_count AS "citationCount",
                   p.published_date AS "publishedDate",
                   NULL::varchar AS lab,
                   NULL::text AS authors,
                   NULL::varchar AS category,
                   NULL::int AS "referenceYear",
                   NULL::int AS "admissionYear",
                   NULL::int AS "entryYear"
            FROM paper p
            WHERE p.embedding IS NOT NULL
            UNION ALL
            SELECT 'hai' AS type, h.id::text AS id, h.title, h.abstract AS body,
                   1 - (h.embedding::vector <=> $1::vector) AS similarity,
                   0 AS "citationCount",
                   h.published_year AS "publishedDate",
                   h.department AS lab,
                   h.authors::text AS authors,
                   NULL::varchar AS category,
                   NULL::int AS "referenceYear",
                   NULL::int AS "admissionYear",
                   NULL::int AS "entryYear"
            FROM hai_paper h
            WHERE h.embedding IS NOT NULL
            UNION ALL
            SELECT 'gradInfo' AS type, g.id::text AS id, g.title,
                   left(g.content, ${this.maxGradInfoBodyLength}) AS body,
                   1 - (g.embedding::vector <=> $1::vector) AS similarity,
                   0 AS "citationCount",
                   to_char(g."createdAt", 'YYYY-MM-DD') AS "publishedDate",
                   NULL::varchar AS lab,
                   NULL::text AS authors,
                   g.category,
                   g."referenceYear",
                   g."admissionYear",
                   g."entryYear"
            FROM grad_info g
            WHERE g.embedding IS NOT NULL AND g."isPublished" = true
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

    const today = new Date().toISOString().slice(0, 10);

    const userContent = historyText
      ? `[오늘 날짜] ${today}\n\n[이전 대화]\n${historyText}\n\n[현재 질문]\n${dto.question}`
      : `[오늘 날짜] ${today}\n\n[현재 질문]\n${dto.question}`;

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
        // 사람 이름만 와야 한다. 긴 문장이 오면 연구실 검색 조건으로 쓰기 어려우므로 버린다.
        labName:
          typeof parsed.labName === 'string' && parsed.labName.trim().length <= 10
            ? parsed.labName.trim()
            : '',
        fieldTag: this.normalizeFieldTag(parsed.fieldTag),
        dateFrom: this.normalizeDate(parsed.dateFrom),
        dateTo: this.normalizeDate(parsed.dateTo),
        wantsRecent: parsed.wantsRecent === true,
      };
    } catch (e) {
      this.logger.warn(
        `가상 문서 생성 실패, 원문 질문 사용: ${(e as Error).message}`,
      );
      return {
        hypotheticalDoc: dto.question,
        wantsBeginnerFriendly: false,
        needsSearch: true,
        labName: '',
        fieldTag: '',
        dateFrom: '',
        dateTo: '',
        wantsRecent: false,
      };
    }
  }

  // GPT가 엉뚱한 값을 넣어도 검색 조건이 깨지지 않도록 걸러낸다.
  private readonly allowedFieldTags = [
    'cs.CV', 'cs.CL', 'cs.LG', 'cs.RO', 'cs.IR',
    'cs.SD', 'cs.HC', 'cs.MM', 'cs.SE', 'stat.ML',
  ];

  private normalizeFieldTag(value: unknown) {
    if (typeof value !== 'string') return '';

    const tag = value.trim();

    return this.allowedFieldTags.includes(tag) ? tag : '';
  }

  private normalizeDate(value: unknown) {
    if (typeof value !== 'string') return '';

    const date = value.trim();

    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  }

  private async embedQuestion(question: string): Promise<string> {
    const response = await this.openai.embeddings.create({
      model: this.embeddingModel,
      input: question,
    });

    return JSON.stringify(response.data[0].embedding);
  }

  // hai_paper의 authors는 simple-json이라 DB에서 '["홍길동","김철수"]' 같은 문자열로 온다.
  // 그대로 프롬프트에 넣으면 지저분하므로 사람이 읽는 형태로 바꾼다.
  private formatAuthors(authors?: string | null) {
    if (!authors) return null;

    try {
      const parsed = JSON.parse(authors) as string[];
      return parsed.length > 0 ? `저자 ${parsed.join(', ')}` : null;
    } catch {
      return `저자 ${authors}`;
    }
  }

  private formatPublished(publishedDate?: string | null) {
    if (!publishedDate) return null;

    return /^\d{4}-\d{2}-\d{2}$/.test(publishedDate)
      ? `발행일 ${publishedDate}`
      : `발표년도 ${publishedDate.slice(0, 4)}`;
  }

  private buildSystemPrompt(candidates: SimilarContentRow[], note = ''): string {
    if (candidates.length === 0) {
      return `${this.systemPromptBase}\n\n[자료 목록]\n없음`;
    }

    // 논문과 진학 정보는 성격이 달라서(검증된 연구 vs 개인 경험·안내 자료) 종류를 라벨로
    // 명확히 구분해 넘긴다 — 구분이 없으면 GPT가 안내 자료를 선배 경험처럼 말하거나
    // 진학 정보를 논문처럼 인용한다.
    const list = candidates
      .map((c, i) => {
        if (c.type === 'gradInfo') {
          const label = c.category
            ? GRAD_INFO_LABELS[c.category]
            : GRAD_INFO_LABELS[GradInfoCategory.ETC];

          const meta = [
            c.referenceYear ? `기준 연도 ${c.referenceYear}년` : null,
            c.admissionYear ? `작성자 학번 ${c.admissionYear}` : null,
            c.entryYear ? `대학원 입학 ${c.entryYear}년` : null,
            c.researchFields ? `연구 분야 ${c.researchFields}` : null,
          ]
            .filter(Boolean)
            .join(', ');

          return `${i + 1}. [진학 정보 - ${label}] 제목: ${c.title}${meta ? `\n   ${meta}` : ''}\n   내용: ${c.body}`;
        }

        if (c.type === 'hai') {
          const meta = [
            c.lab ? `${c.lab} (지도교수 연구실)` : null,
            this.formatAuthors(c.authors),
            this.formatPublished(c.publishedDate),
          ]
            .filter(Boolean)
            .join(', ');

          return `${i + 1}. [휴먼AI공학전공 논문] 제목: ${c.title}${meta ? `\n   ${meta}` : ''}\n   초록: ${c.body}`;
        }

        const meta = [
          c.citationCount ? `인용수 ${c.citationCount}회` : null,
          // arXiv 논문은 발행일이 YYYY-MM-DD로 있다. 연도만 넘기면 "1월에 나온 논문" 같은
          // 질문에 GPT가 월을 확인할 수 없다고 답하게 되므로 날짜를 그대로 넘긴다.
          this.formatPublished(c.publishedDate),
        ]
          .filter(Boolean)
          .join(', ');

        return `${i + 1}. [논문] 제목: ${c.title}${meta ? `\n   ${meta}` : ''}\n   초록: ${c.body}`;
      })
      .join('\n');

    const header = note ? `[자료 목록] ${note}` : '[자료 목록]';

    return `${this.systemPromptBase}\n\n${header}\n${list}`;
  }
}
