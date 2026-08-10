import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PaperAiSummary } from './entities/paper-ai-summaries.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { PapersService } from 'src/papers/papers.service';
import { HaiPaperAiSummary } from './entities/hai-paper-ai-summaries.entity';
import { HaiPapersService } from 'src/papers/hai-papers/hai-papers.service';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';
import { Paper } from 'src/papers/entities/papers.entity';
import { HaiPaper } from 'src/papers/entities/hai-papers.entity';
import OpenAI from 'openai';

@Injectable()
export class AiServicesService {
    private readonly openai: OpenAI;
    private readonly gptModel = 'gpt-5.4-mini'; // 기본 논문 AI 요약에 사용하는 모델
    private readonly embeddingModel = 'text-embedding-3-large'; // 논문 임베딩 벡터 생성에 사용하는 모델
    private readonly defaultBatchSize = 20; // 배치 처리 시 한 번에 동시 처리할 논문 수

    constructor(
        @InjectRepository(PaperAiSummary)
        private readonly paperAiSummaryRepository: Repository<PaperAiSummary>,
        @InjectRepository(HaiPaperAiSummary)
        private readonly haiPaperAiSummaryRepository: Repository<HaiPaperAiSummary>,
        @InjectRepository(Paper)
        private readonly papersRepository: Repository<Paper>,
        @InjectRepository(HaiPaper)
        private readonly haiPapersRepository: Repository<HaiPaper>,
        private readonly papersService: PapersService,
        private readonly haiPapersService: HaiPapersService,
        private readonly configService: ConfigService,
    ){
        this.openai = new OpenAI({ 
            apiKey: this.configService.get<string>(envVariableKeys.openaiApiKey),
        });
    }
    // 기본 논문 AI 요약, 휴먼과 논문 AI 요약, 논문 제목+초록 임베딩 벡터, 로드맵 AI 피드백

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // 1. 기본 논문 AI 요약 관련 코드

    async getAllPaperAiSummary(){
        return this.paperAiSummaryRepository.find({
            relations: {
                paper: true,
            },
            select: {
                id: true,
                whyRead: true,
                abstractKor: true,
                what: true,
                how: true,
                impact: true,
                model: true,
                paper: {
                    arxivId: true,
                    title: true,
                },
            }
        });
    }

    async getPaperAiSummaryByArxivId(arxivId: string){
    const paperAiSummary = await this.paperAiSummaryRepository.findOne({
        where: {
            paper: { arxivId },
        },
        relations: {
            paper: true,
        }
    });

    if(!paperAiSummary){
        throw new NotFoundException('해당 논문의 AI 요약이 존재하지 않습니다!');
    }

    return paperAiSummary;
    }


    // // ai모델 사용 전에 테스트를 위해 직접 데이터를 생성하는 코드(직접 데이터 생성. 나중에 지울 예정)
    // async createPaperAiSummary(arxivId: string, dto: CreatePaperAiSummaryDTO){
    //     const existingPaperAiSummary = await this.paperAiSummaryRepository.exists({
    //         where: {
    //             paper: { 
    //                 arxivId 
    //             },
    //         },
    //     });

    //     if(existingPaperAiSummary){
    //         throw new ConflictException('해당 논문의 AI 요약이 이미 존재합니다!');
    //     }

    //     const paper = await this.papersService.getPaperByArxivId(arxivId);

    //     const paperAiSummary = this.paperAiSummaryRepository.create({
    //         ...dto, 
    //         paper,
    //     })

    //     return this.paperAiSummaryRepository.save(paperAiSummary);
    // }

    // 단일 논문 AI 요약 생성(arxivId 기준)
    async generatePaperAiSummary(arxivId: string) {
        const existingPaperAiSummary = await this.paperAiSummaryRepository.exists({
            where: { paper: { arxivId } },
        });

        if (existingPaperAiSummary) {
            throw new ConflictException('해당 논문의 AI 요약이 이미 존재합니다!');
        }

        const paper = await this.papersRepository.findOne({ where: { arxivId } });

        if (!paper) {
            throw new NotFoundException('존재하지 않는 논문입니다!');
        }

        return this.summarizeAndSavePaper(paper, new Date().getFullYear());
    }

    // AI 요약이 없는 모든 논문에 대해 배치 단위로 요약 생성
    // - Promise.allSettled로 묶어서 한 건이 실패해도 나머지는 계속 진행
    // - 배치 사이마다 짧게 대기하여 OpenAI rate limit 완화
    async generateAllPaperAiSummaries(batchSize?: number) {
        const size = batchSize && batchSize > 0 ? batchSize : this.defaultBatchSize;

        // aiSummary가 아직 없는 논문만 조회
        const papers = await this.papersRepository
            .createQueryBuilder('paper')
            .leftJoin('paper.aiSummary', 'aiSummary')
            .where('aiSummary.id IS NULL')
            .getMany();

        if (papers.length === 0) {
            return { total: 0, success: 0, failed: 0, batchSize: size, failedArxivIds: [] };
        }

        const currentYear = new Date().getFullYear();
        let success = 0;
        const failedArxivIds: string[] = [];

        for (let i = 0; i < papers.length; i += size) {
            const batch = papers.slice(i, i + size);

            const results = await Promise.allSettled(
                batch.map((paper) => this.summarizeAndSavePaper(paper, currentYear)),
            );

            results.forEach((res, idx) => {
                if (res.status === 'fulfilled') {
                    success++;
                } else {
                    failedArxivIds.push(batch[idx].arxivId);
                }
            });

            // 마지막 배치가 아니면 다음 배치 전에 잠깐 대기
            if (i + size < papers.length) {
                await this.sleep(1000);
            }
        }

        return {
            total: papers.length,
            success,
            failed: failedArxivIds.length,
            batchSize: size,
            failedArxivIds,
        };
    }

    // 논문 1건에 대해 GPT 요약을 생성하고 저장(존재 여부 검사는 호출부 책임)
    private async summarizeAndSavePaper(paper: Paper, currentYear: number) {
        const result = await this.requestPaperAiSummary(paper, currentYear);

        const paperAiSummary = this.paperAiSummaryRepository.create({
            whyRead: result.whyRead,
            abstractKor: result.abstractKor,
            what: result.what,
            how: result.how,
            impact: result.impact,
            model: this.gptModel,
            paper,
        });

        return this.paperAiSummaryRepository.save(paperAiSummary);
    }

    // GPT를 호출해 요약 JSON을 받아 파싱하여 반환
    private async requestPaperAiSummary(paper: Paper, currentYear: number) {
        const systemPrompt = `
            You are an AI that summarizes academic papers in Korean.

            Return a JSON object with exactly these fields:

            - whyRead: 이 논문이 왜 중요한지, 어떤 독자에게 유용한지. 중요도 별점(1~3)에 따라 뉘앙스를 다르게 작성:
                - 별 1개: 특정 분야 전공자에게만 유용한 수준으로 작성
                - 별 2개: 관련 분야 연구자라면 읽을 만한 수준으로 작성
                - 별 3개: 해당 분야 필독 논문 수준으로 작성
                반드시 180~200자 사이로 작성한다.

            - abstractKor: 논문 초록을 한국어로 자연스럽고 읽기 쉽게 번역한다.
                직역보다는 의미 전달을 우선한다.
                한국 논문 초록 스타일을 따른다.
                영어 문장 구조를 그대로 옮긴 번역체 표현은 피한다.
                모델명, 데이터셋명, 알고리즘명, 고유 개념명은 유지한다.
                의미 전달에 불필요한 직역 표현은 자연스러운 한국어 표현으로 바꾼다.

            - what: 이 논문이 해결하려는 핵심 문제, 기존 연구의 한계, 그리고 이 논문의 연구 목표를 구체적으로 작성한다.
                반드시 180~200자 사이로 작성한다.

            - how: 제안한 모델, 알고리즘, 데이터셋, 실험 설계 등 핵심 방법론을 구체적으로 작성한다.
                반드시 180~200자 사이로 작성한다.

            - impact: user message의 currentYear와 publishedDate를 비교하여 아래 기준에 따라 작성한다.
                - publishedDate의 연도가 currentYear 기준 2년 이내인 경우:
                    논문의 실험 결과와 수치, 그리고 향후 연구에 어떤 영향을 미칠 수 있는지 가능성 중심으로 작성한다.
                - publishedDate의 연도가 currentYear 기준 2년 초과인 경우:
                    실험 결과 수치나 성과, 그리고 이 연구가 해당 분야의 후속 연구에 미친 실제 영향을 구체적으로 작성한다.
                반드시 180~200자 사이로 작성한다.
        `; 

        const userPrompt = 
            `currentYear: ${currentYear}
                arxivId: ${paper.arxivId}
                title: ${paper.title}
                abstract: ${paper.abstract}
                publishedDate: ${paper.publishedDate}
                starTier: ${paper.starTier}`;

        const response = await this.openai.chat.completions.create({
            model: this.gptModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
        });

        try {
            return JSON.parse(response.choices[0].message.content!);
        } catch (e) {
            throw new InternalServerErrorException('AI 응답 파싱에 실패했습니다.');
        }
    }

    // 배치 간 대기용 sleep
    private sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }


    //////////////////////////////////////////////////////////////////////////////////////////////////
    // 2. 휴먼과 논문 AI 요약 관련 코드

    async getAllHaiPaperAiSummary(){
        return this.haiPaperAiSummaryRepository.find({
            relations: {
                haiPaper: true,
            },
            select: {
                id: true,
                abstractKor: true,
                what: true,
                how: true,
                impact: true,
                model: true,
                haiPaper: {
                    id: true,
                    title: true,
                },
            }
        });
    }

    async getHaiPaperAiSummaryById(id: number){
        const haiPaperAiSummary = await this.haiPaperAiSummaryRepository.findOne({
            where: {
                haiPaper: { id },
            },
            relations: {
                haiPaper: true,
            }
        });

        if(!haiPaperAiSummary){
            throw new NotFoundException('해당 논문의 AI 요약이 존재하지 않습니다!');
        }

        return haiPaperAiSummary;
    }

    // 단일 휴먼과 논문 AI 요약 생성(id 기준)
    async createHaiPaperAiSummary(id: number){
        const existingHaiPaperAiSummary = await this.haiPaperAiSummaryRepository.exists({
            where: {
                haiPaper: {
                    id,
                },
            },
        });

        if(existingHaiPaperAiSummary){
            throw new ConflictException('해당 논문의 AI 요약이 이미 존재합니다!');
        }

        const haiPaper = await this.haiPapersService.getHaiPaperById(id);

        const result = await this.requestHaiPaperAiSummary(haiPaper, new Date().getFullYear());

        const haiPaperAiSummary = this.haiPaperAiSummaryRepository.create({
            abstractKor: result.abstractKor,
            what: result.what,
            how: result.how,
            impact: result.impact,
            model: this.gptModel,
            haiPaper,
        })

        return this.haiPaperAiSummaryRepository.save(haiPaperAiSummary);
    }

    // GPT를 호출해 휴먼과 논문 요약 JSON을 받아 파싱하여 반환
    private async requestHaiPaperAiSummary(haiPaper: HaiPaper, currentYear: number) {
        const systemPrompt = `
            You are an AI that summarizes academic papers in Korean.

            Return a JSON object with exactly these fields:

            - abstractKor: 논문 초록을 한국어로 자연스럽고 읽기 쉽게 번역한다.
                직역보다는 의미 전달을 우선한다.
                한국 논문 초록 스타일을 따른다.
                영어 문장 구조를 그대로 옮긴 번역체 표현은 피한다.
                모델명, 데이터셋명, 알고리즘명, 고유 개념명은 유지한다.
                의미 전달에 불필요한 직역 표현은 자연스러운 한국어 표현으로 바꾼다.

            - what: 이 논문이 해결하려는 핵심 문제, 기존 연구의 한계, 그리고 이 논문의 연구 목표를 구체적으로 작성한다.
                반드시 180~200자 사이로 작성한다.

            - how: 제안한 모델, 알고리즘, 데이터셋, 실험 설계 등 핵심 방법론을 구체적으로 작성한다.
                반드시 180~200자 사이로 작성한다.

            - impact: user message의 currentYear와 publishedYear를 비교하여 아래 기준에 따라 작성한다.
                - publishedYear가 currentYear 기준 2년 이내인 경우:
                    논문의 실험 결과와 수치, 그리고 향후 연구에 어떤 영향을 미칠 수 있는지 가능성 중심으로 작성한다.
                - publishedYear가 currentYear 기준 2년 초과인 경우:
                    실험 결과 수치나 성과, 그리고 이 연구가 해당 분야의 후속 연구에 미친 실제 영향을 구체적으로 작성한다.
                반드시 180~200자 사이로 작성한다.
        `;

        const userPrompt =
            `currentYear: ${currentYear}
                title: ${haiPaper.title}
                abstract: ${haiPaper.abstract}
                publishedYear: ${haiPaper.publishedYear}`;

        const response = await this.openai.chat.completions.create({
            model: this.gptModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
        });

        try {
            return JSON.parse(response.choices[0].message.content!);
        } catch (e) {
            throw new InternalServerErrorException('AI 응답 파싱에 실패했습니다.');
        }
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // 3. 논문 제목+초록 임베딩 벡터

    // 단일 논문 임베딩 벡터 생성(arxivId 기준)
    async generatePaperEmbedding(arxivId: string) {
        const paper = await this.papersRepository.findOne({
            where: { arxivId },
            select: { arxivId: true, title: true, abstract: true, embedding: true },
        });

        if (!paper) {
            throw new NotFoundException('존재하지 않는 논문입니다!');
        }

        if (paper.embedding) {
            throw new ConflictException('해당 논문의 임베딩이 이미 존재합니다!');
        }

        await this.embedAndSavePaper(paper);

        return { success: true };
    }

    // 임베딩이 없는 모든 논문에 대해 배치 단위로 임베딩 생성
    // - Promise.allSettled로 묶어서 한 건이 실패해도 나머지는 계속 진행
    // - 배치 사이마다 짧게 대기하여 OpenAI rate limit 완화
    async generateAllPaperEmbeddings(batchSize?: number) {
        const size = batchSize && batchSize > 0 ? batchSize : this.defaultBatchSize;

        // embedding이 아직 없는 논문만 조회
        const papers = await this.papersRepository.find({
            where: { embedding: IsNull() },
            select: { arxivId: true, title: true, abstract: true },
        });

        if (papers.length === 0) {
            return { total: 0, success: 0, failed: 0, batchSize: size, failedArxivIds: [] };
        }

        let success = 0;
        const failedArxivIds: string[] = [];

        for (let i = 0; i < papers.length; i += size) {
            const batch = papers.slice(i, i + size);

            const results = await Promise.allSettled(
                batch.map((paper) => this.embedAndSavePaper(paper)),
            );

            results.forEach((res, idx) => {
                if (res.status === 'fulfilled') {
                    success++;
                } else {
                    failedArxivIds.push(batch[idx].arxivId);
                }
            });

            // 마지막 배치가 아니면 다음 배치 전에 잠깐 대기
            if (i + size < papers.length) {
                await this.sleep(1000);
            }
        }

        return {
            total: papers.length,
            success,
            failed: failedArxivIds.length,
            batchSize: size,
            failedArxivIds,
        };
    }

    // 논문 1건에 대해 임베딩 벡터를 생성하고 저장(존재 여부 검사는 호출부 책임)
    private async embedAndSavePaper(paper: Pick<Paper, 'arxivId' | 'title' | 'abstract'>) {
        const input = `${paper.title}\n\n${paper.abstract}`;

        const response = await this.openai.embeddings.create({
            model: this.embeddingModel,
            input,
        });

        const embedding = response.data[0].embedding; // 3072차원 벡터

        await this.papersRepository.update(
            { arxivId: paper.arxivId },
            { embedding: JSON.stringify(embedding) },
        );
    }

    // 단일 휴먼과 논문 임베딩 벡터 생성(id 기준)
    async generateHaiPaperEmbedding(id: number) {
        const haiPaper = await this.haiPapersRepository.findOne({
            where: { id },
            select: { id: true, title: true, abstract: true, embedding: true },
        });

        if (!haiPaper) {
            throw new NotFoundException('존재하지 않는 논문입니다!');
        }

        if (haiPaper.embedding) {
            throw new ConflictException('해당 논문의 임베딩이 이미 존재합니다!');
        }

        await this.embedAndSaveHaiPaper(haiPaper);

        return { success: true };
    }

    // 휴먼과 논문 1건에 대해 임베딩 벡터를 생성하고 저장(존재 여부 검사는 호출부 책임)
    private async embedAndSaveHaiPaper(haiPaper: Pick<HaiPaper, 'id' | 'title' | 'abstract'>) {
        const input = `${haiPaper.title}\n\n${haiPaper.abstract}`;

        const response = await this.openai.embeddings.create({
            model: this.embeddingModel,
            input,
        });

        const embedding = response.data[0].embedding; // 3072차원 벡터

        await this.haiPapersRepository.update(
            { id: haiPaper.id },
            { embedding: JSON.stringify(embedding) },
        );
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // 4. 로드맵 AI

    // 종합 코멘트 생성에 필요한 입력값 (roadmap 모듈에서 계산해 전달)
    // 의존성 방향을 위해 roadmap 타입을 import 하지 않고 원시값으로만 받는다.
    private buildFallbackRoadmapComment(params: RoadmapCommentParams): string {
        const strength = params.strengths[0] ?? '기본기';
        const axes = [
            { label: '이해도', value: params.radar.interest },
            { label: '경험', value: params.radar.experience },
            { label: '논문 읽기 루틴', value: params.radar.paper },
            { label: '포트폴리오', value: params.radar.preparation },
            { label: '성적', value: params.radar.academic },
        ];
        const weakest = axes.reduce((a, b) => (b.value < a.value ? b : a));
        return (
            `현재 준비도는 ${params.totalScore}점이에요.\n` +
            `강점은 ${strength}이고, 다음 단계로는 ${weakest.label} 보완을 먼저 하면 좋아요.`
        );
    }

    // 설문 분석 결과를 바탕으로 결과 페이지의 '종합 코멘트' 문구를 GPT로 생성한다.
    // 논문 요약과 동일한 OpenAI 클라이언트/모델/JSON 응답 방식을 사용한다.
    async generateRoadmapComment(params: RoadmapCommentParams): Promise<string> {
        const gptModel = 'gpt-5.4-mini';
        const fallback = this.buildFallbackRoadmapComment(params);

        const systemPrompt = `
            너는 대학원 진학을 준비하는 학생의 로드맵 결과를 요약해 주는 한국어 멘토다.

            반드시 아래 필드 하나만 가진 JSON 객체를 반환한다.
            - comment: 아래 형식과 조건을 모두 지킨 한국어 코멘트 문자열

            형식 (줄바꿈은 \\n 으로 표현):
            1) 첫 줄은 정확히 "현재 준비도는 {score}점이에요." 로 작성한다.
               점수는 user message의 score 값을 그대로 사용하고 임의로 바꾸지 않는다.
            2) 둘째 줄부터는 "강점은 ~이고, 다음 단계로는 ~를 먼저 보완하면 좋아요." 형식으로 작성한다.
               - 강점은 user message의 strengths 중 가장 핵심 1가지를 자연스럽게 요약한다.
               - 다음 단계는 radar 점수 중 가장 낮은 영역을 우선 보완 대상으로 잡아 구체적으로 제안한다.
                 (예: 논문 루틴이 낮으면 "논문 읽기 루틴(월 4~6편 목표)")

            조건:
            - 전체 3~4줄, 공백 포함 100자 내외로 간결하게 작성한다.
            - 격려하는 따뜻한 톤. 과장 표현과 이모지는 쓰지 않는다.
            - 한국어 조사(을/를, 이고/고 등)를 문맥에 맞게 자연스럽게 맞춘다.
        `;

        const userPrompt = `
            score: ${params.totalScore}
            stage: ${params.stage}
            interestFields: ${params.interestFields.join(', ')}
            strengths: ${params.strengths.join(', ') || '없음'}
            weaknesses: ${params.weaknesses.join(', ') || '없음'}
            radar(각 0~10):
              이해도: ${params.radar.interest}
              경험: ${params.radar.experience}
              논문 루틴: ${params.radar.paper}
              포트폴리오: ${params.radar.preparation}
              성적: ${params.radar.academic}
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: gptModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
            });

            const result = JSON.parse(response.choices[0].message.content!);
            const comment =
                typeof result.comment === 'string' ? result.comment.trim() : '';
            return comment || fallback;
        } catch (e) {
            // GPT 호출/파싱 실패 시에도 로드맵 생성은 계속되도록 fallback 코멘트 사용
            return fallback;
        }
    }

    // 결과 페이지 '성장 가이드' 섹션의 제안 문구(tips)를 GPT로 생성한다.
    // 논문 읽기 빈도/대외 경험 수치는 roadmap 모듈에서 이미 계산해 label로 넘겨주므로,
    // GPT는 그 값을 근거로 문구만 작성한다 (숫자 자체를 새로 만들지 않음).
    private buildFallbackGrowthTips(params: RoadmapGrowthGuideParams): string[] {
        return [
            '논문 읽기 횟수를 유지하시되, 이해하고 정리할 수 있는 수준으로 학습해보세요.',
            '관심 있는 분야의 최신 트렌드에 맞춰 다양한 형태의 대외 활동을 꾸준히 진행해보세요.',
        ];
    }

    async generateRoadmapGrowthGuideTips(
        params: RoadmapGrowthGuideParams,
    ): Promise<string[]> {
        const fallback = this.buildFallbackGrowthTips(params);

        const systemPrompt = `
            너는 대학원 진학을 준비하는 학생에게 성장 가이드를 제안하는 한국어 멘토다.

            반드시 아래 필드 하나만 가진 JSON 객체를 반환한다.
            - tips: 정확히 2개의 한국어 문장으로 이루어진 문자열 배열

            작성 규칙:
            1) 첫 번째 문장: user message의 "현재 논문 읽기 빈도"를 참고해서, 그 빈도를 유지하거나
               이해도를 높이는 방향의 논문 읽기 습관 제안
            2) 두 번째 문장: user message의 "현재 대외 경험"과 interestFields를 참고해서,
               관심 분야의 최신 트렌드에 맞는 대외 활동(발표, 프로젝트, 스터디 등) 제안

            조건:
            - 각 문장 40~60자 내외, "~해보세요" 체의 부드러운 권유형으로 끝맺는다.
            - 격려하는 따뜻한 톤. 과장 표현과 이모지는 쓰지 않는다.
            - 숫자(빈도)를 임의로 바꾸지 않는다.
        `;

        const userPrompt = `
            stage: ${params.stage}
            interestFields: ${params.interestFields.join(', ')}
            현재 논문 읽기 빈도: ${params.paperFrequencyLabel}
            현재 대외 경험: ${params.externalActivityLabel}
            strengths: ${params.strengths.join(', ') || '없음'}
            weaknesses: ${params.weaknesses.join(', ') || '없음'}
            radar(각 0~10):
              이해도: ${params.radar.interest}
              경험: ${params.radar.experience}
              논문 루틴: ${params.radar.paper}
              포트폴리오: ${params.radar.preparation}
              성적: ${params.radar.academic}
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: this.gptModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
            });

            const result = JSON.parse(response.choices[0].message.content!);
            const tips = Array.isArray(result.tips)
                ? result.tips.filter(
                      (t: unknown) => typeof t === 'string' && t.trim(),
                  )
                : [];
            return tips.length === 2 ? tips : fallback;
        } catch (e) {
            // GPT 호출/파싱 실패 시에도 로드맵 생성은 계속되도록 fallback 문구 사용
            return fallback;
        }
    }
}

// 로드맵 종합 코멘트 생성 입력값
export interface RoadmapCommentParams {
    totalScore: number;
    stage: string;
    interestFields: string[];
    strengths: string[];
    weaknesses: string[];
    radar: {
        interest: number;
        experience: number;
        paper: number;
        preparation: number;
        academic: number;
    };
}

// 로드맵 성장 가이드(tips) 생성 입력값
// paperFrequencyLabel/externalActivityLabel은 roadmap 모듈에서 답변을 기반으로 미리 계산해 전달한다.
export interface RoadmapGrowthGuideParams {
    stage: string;
    interestFields: string[];
    paperFrequencyLabel: string;
    externalActivityLabel: string;
    strengths: string[];
    weaknesses: string[];
    radar: {
        interest: number;
        experience: number;
        paper: number;
        preparation: number;
        academic: number;
    };
}
