import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ResearchField } from 'src/research-fields/entities/research-fields.entity';
import { Not, Repository } from 'typeorm';
import { UpdateResearchFieldDto } from './dto/update-research-field.dto';
import { CreateResearchFieldDto } from './dto/create-research-field.dto';

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

    // 분야 생성하기
    async createResearchField(dto: CreateResearchFieldDto){
        const { name, tag } = dto;

        const researchFieldExists = await this.researchFieldsRepository.exists({
            where: {
                name,
            }
        });

        if(researchFieldExists){
            throw new ConflictException('이미 존재하는 연구 분야입니다!');
        }

        const tagExists = await this.researchFieldsRepository.exists({
            where: {
                tag,
            }
        });

        if(tagExists){
            throw new ConflictException('이미 존재하는 태그입니다!');
        }

        const researchField = this.researchFieldsRepository.create({ name, tag });

        return this.researchFieldsRepository.save(researchField);
    }

    // 분야 수정(태그 등)
    async updateResearchField(id: number, dto: UpdateResearchFieldDto){
        const researchField = await this.researchFieldsRepository.exists({
            where: {
                id,
            }
        });

        if(!researchField){
            throw new NotFoundException('존재하지 않는 연구 분야입니다!');
        }

        if(dto.name){
            const nameExists = await this.researchFieldsRepository.exists({
                where: {
                    id: Not(id),
                    name: dto.name,
                }
            });

            if(nameExists){
                throw new ConflictException('이미 존재하는 연구 분야입니다!');
            }
        }

        if(dto.tag){
            const tagExists = await this.researchFieldsRepository.exists({
                where: {
                    id: Not(id),
                    tag: dto.tag,
                }
            });

            if(tagExists){
                throw new ConflictException('이미 존재하는 태그입니다!');
            }
        }

        await this.researchFieldsRepository.update(id, dto);

        return this.researchFieldsRepository.findOne({
            where: {
                id,
            }
        });
    }
}
