import { Injectable, NotFoundException } from '@nestjs/common';
import { PaperAiSummary } from './entities/paper-ai-summaries.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { PapersService } from 'src/papers/papers.service';

@Injectable()
export class AiServicesService {
    constructor(
        @InjectRepository(PaperAiSummary)
        private readonly paperAiSummaryRepository: Repository<PaperAiSummary>,
        private readonly papersService: PapersService,
    ){}

    async getAllPaperAiSummary(){
        return this.paperAiSummaryRepository.find({
            relations: {
                paper: true,
            },
            select: {
                id: true,
                aiSummary: true,
                abstract_kor: true,
                what: true,
                how: true,
                so_what: true,
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
        const existingPaperAiSummary = await this.paperAiSummaryRepository.findOne({
            where: {
                paper: { arxivId },
            },
        });

        if(existingPaperAiSummary){
            throw new NotFoundException('해당 논문의 AI 요약이 이미 존재합니다!');
        }

        const paper = await this.papersService.getPaperByArxivId(arxivId);
        if (!paper){
            throw new NotFoundException('존재하지 않는 논문입니다!');
        }

        const paperAiSummary = this.paperAiSummaryRepository.create({
            ...dto, 
            paper,
        })

        return this.paperAiSummaryRepository.save(paperAiSummary);
    }

}
