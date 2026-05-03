import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';
import { HaiPaper } from '../entities/hai-papers.entity';



@Injectable()
export class HaiPapersService {
  constructor(
    @InjectRepository(HaiPaper)
    private readonly haipapersRepository: Repository<HaiPaper>,
  ) {}

  async createHaiPaper(dto: CreateHAIpaperDto) {
    const paper = this.haipapersRepository.create(dto);
    return this.haipapersRepository.save(paper);
  }

  async getAllHaiPapers() {
    return this.haipapersRepository.find();
  }

  async getHaiPaper(id: number){
    const haiPaper = this.haipapersRepository.findOne({
      where: {
        id,
      },
    })

    if(!haiPaper){
      throw new NotFoundException('존재하지 않는 논문입니다!');
    }

    return haiPaper;
  }

  async updateHaiPaper(id: number, dto: UpdatHAIpaperDto) {
    await this.haipapersRepository.update(id, dto);
    return this.haipapersRepository.findOne({
      where: {
        id,
      }
    }); 
  }

  async deleteHaiPaper(id: number) {
    await this.haipapersRepository.delete(id);
  }
}
