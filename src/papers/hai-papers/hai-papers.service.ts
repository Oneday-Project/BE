import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';
import { HaiPaper } from '../entities/hai-papers.entity';
import { PapersService } from '../papers.service';



@Injectable()
export class HaiPapersService {
  constructor(
    @InjectRepository(HaiPaper)
    private readonly haipapersRepository: Repository<HaiPaper>,
    private readonly papersService: PapersService,
  ) {}

  async createHaiPaper(dto: CreateHAIpaperDto) {
    const haiPaperExists = await this.haipapersRepository.exists({
      where: {
        doi: dto.doi,
        title: dto.title,
      }
    });

    if(haiPaperExists){
      throw new ConflictException('이미 존재하는 휴먼과 논문입니다!');
    }

    const haiPaper = this.haipapersRepository.create(dto);
    return this.haipapersRepository.save(haiPaper);
  }

  async getAllHaiPapers() {
    return this.haipapersRepository.find();
  }

  async getHaiPaperById(id: number){
    const haiPaper = await this.haipapersRepository.findOne({
      where: {
        id,
      },
    })

    if(!haiPaper){
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    return haiPaper;
  }

  async updateHaiPaper(id: number, dto: UpdatHAIpaperDto) {
    const haiPaper = await this.haipapersRepository.exists({
      where: {
        id,
      },
    })

    if(!haiPaper){
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    await this.haipapersRepository.update(id, dto);
    return this.haipapersRepository.findOne({
      where: {
        id,
      }
    }); 
  }

  async deleteHaiPaper(id: number) {
    const haiPaper = await this.haipapersRepository.exists({
      where: {
        id,
      },
    })

    if(!haiPaper){
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    await this.haipapersRepository.delete(id);
  }

  // 휴먼과 논문 기준 유사 논문 추천(기본 논문 + 휴먼과 논문 통합)
  async getSimilarHaiPapers(id: number, limit: number = 5) {
    const haiPaper = await this.haipapersRepository.findOne({
      where: { id },
      select: { id: true, embedding: true },
    });

    if (!haiPaper || !haiPaper.embedding) {
      throw new NotFoundException('해당 논문의 임베딩이 존재하지 않습니다.');
    }

    return this.papersService.findSimilarByEmbedding(haiPaper.embedding, { haiId: id }, limit);
  }
}
