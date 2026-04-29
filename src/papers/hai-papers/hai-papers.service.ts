import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';
import { HAIpapers } from '../entities/hai-papers.entity';



@Injectable()
export class HaiPapersService {
  constructor(
    @InjectRepository(HAIpapers)
    private readonly haipapersRepository: Repository<HAIpapers>,
  ) {}

  async createPaper(dto: CreateHAIpaperDto) {
    const paper = this.haipapersRepository.create(dto);
    return this.haipapersRepository.save(paper);
  }

  async getAllPapers() {
    return this.haipapersRepository.find();
  }

  async updatePaper(id: number, dto: UpdatHAIpaperDto) {
    await this.haipapersRepository.update(id, dto);
    return this.haipapersRepository.findOne({
      where: {
        id,
      }
    }); 
  }

  async deletePaper(id: number) {
    await this.haipapersRepository.delete(id);
  }
}
