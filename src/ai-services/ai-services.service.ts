import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaperAiSummary } from './entities/paper-ai-summaries.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { PapersService } from 'src/papers/papers.service';
import { HaiPaperAiSummary } from './entities/hai-paper-ai-summaries.entity';
import { CreateHaiPaperAiSummaryDTO } from './dto/create-hai-paper-ai-summary.dto';
import { HaiPapersService } from 'src/papers/hai-papers/hai-papers.service';

@Injectable()
export class AiServicesService {
    constructor(
        @InjectRepository(PaperAiSummary)
        private readonly paperAiSummaryRepository: Repository<PaperAiSummary>,
        @InjectRepository(HaiPaperAiSummary)
        private readonly haiPaperAiSummaryRepository: Repository<HaiPaperAiSummary>,
        private readonly papersService: PapersService,
        private readonly haiPapersService: HaiPapersService,
    ){}

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


    // ai모델 사용 전에 테스트를 위해 직접 데이터를 생성하는 코드
    async createPaperAiSummary(arxivId: string, dto: CreatePaperAiSummaryDTO){
        const existingPaperAiSummary = await this.paperAiSummaryRepository.exists({
            where: {
                paper: { 
                    arxivId 
                },
            },
        });

        if(existingPaperAiSummary){
            throw new ConflictException('해당 논문의 AI 요약이 이미 존재합니다!');
        }

        const paper = await this.papersService.getPaperByArxivId(arxivId);
        if (!paper){
            throw new BadRequestException('존재하지 않는 논문입니다!');
        }

        const paperAiSummary = this.paperAiSummaryRepository.create({
            ...dto, 
            paper,
        })

        return this.paperAiSummaryRepository.save(paperAiSummary);
    }

    // 휴먼과 논문 AI 요약 관련 코드
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

    async createHaiPaperAiSummary(id: number, dto: CreateHaiPaperAiSummaryDTO){
        const existingPaperAiSummary = await this.haiPaperAiSummaryRepository.exists({
            where: {
                haiPaper: { 
                    id, 
                },
            },
        });

        if(existingPaperAiSummary){
            throw new ConflictException('해당 논문의 AI 요약이 이미 존재합니다!');
        }

        const haiPaper = await this.haiPapersService.getHaiPaperById(id);
        if (!haiPaper){
            throw new BadRequestException('존재하지 않는 논문입니다!');
        }

        const paperAiSummary = this.haiPaperAiSummaryRepository.create({
            ...dto, 
            haiPaper,
        })

        return this.paperAiSummaryRepository.save(paperAiSummary);
    }

}
