import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PaperAiSummary } from './entities/paper-ai-summaries.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { PapersService } from 'src/papers/papers.service';
import { HaiPaperAiSummary } from './entities/hai-paper-ai-summaries.entity';
import { CreateHaiPaperAiSummaryDTO } from './dto/create-hai-paper-ai-summary.dto';
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

        const paper = await this.papersService.getPaperByArxivId(arxivId);

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

    // ai모델 사용 전에 테스트를 위해 직접 데이터를 생성하는 코드(직접 데이터 생성. 나중에 지울 예정)
    async createHaiPaperAiSummary(id: number, dto: CreateHaiPaperAiSummaryDTO){
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

        const haiPaperAiSummary = this.haiPaperAiSummaryRepository.create({
            ...dto, 
            haiPaper,
        })

        return this.haiPaperAiSummaryRepository.save(haiPaperAiSummary);
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // 3. 논문 제목+초록 임베딩 벡터

    // 기본 논문 제목+초록 임베딩 벡터(아직은 단일 논문 기준 -> 추후에 배치 사이즈 만큼 논문 요약 코드로 수정 예정)
    async generatePaperEmbedding(arxivId: string) {
        const embeddingModel = 'text-embedding-3-large';

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

        const input = `${paper.title}\n\n${paper.abstract}`;

        const response = await this.openai.embeddings.create({
            model: embeddingModel,
            input,
        });

        const embedding = response.data[0].embedding; // 3072차원 벡터

        await this.papersRepository.update(
            { arxivId },
            { embedding: JSON.stringify(embedding) },
        );

        return { success: true };
    }

    // 휴먼과 논문 제목+초록 임베딩 벡터(아직은 단일 논문 기준 -> 추후에 배치 사이즈 만큼 논문 요약 코드로 수정 예정)
    async generateHaiPaperEmbedding(id: number) {
        const embeddingModel = 'text-embedding-3-large';

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

        const input = `${haiPaper.title}\n\n${haiPaper.abstract}`;

        const response = await this.openai.embeddings.create({
            model: embeddingModel,
            input,
        });

        const embedding = response.data[0].embedding; // 3072차원 벡터

        await this.haiPapersRepository.update(
            { id },
            { embedding: JSON.stringify(embedding) },
        );

        return { success: true };
    }

    //////////////////////////////////////////////////////////////////////////////////////////////////
    // 4. 로드맵 AI



}
