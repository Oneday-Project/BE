import { Injectable } from '@nestjs/common';
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
        const category = this.researchFieldsRepository.create({name});

        return this.researchFieldsRepository.save(category);
    }
}
