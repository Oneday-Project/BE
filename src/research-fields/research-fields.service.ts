import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ResearchField } from 'src/research-fields/entities/research-fields.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ResearchFieldsService {
    constructor(
        @InjectRepository(ResearchField)
        private readonly researchFieldsRepository: Repository<ResearchField>,
    ){}

    // 모든 분야 GET
    async getAllResearchFields(){
        return this.researchFieldsRepository.find();
    }

    // 분야 생성
    async createResearchField(name: string){
        const researchFieldExists = await this.researchFieldsRepository.exists({
            where: {
                name,
            }
        });

        if(researchFieldExists){
            throw new ConflictException('이미 존재하는 연구 분야입니다!');
        }

        const researchField = this.researchFieldsRepository.create({name});

        return this.researchFieldsRepository.save(researchField);
    }
}
