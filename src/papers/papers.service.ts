import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Papers } from './entities/papers.entity';
import { Repository } from 'typeorm';
import { GetPapersDto } from './dto/get-papers.dto';
import { CommonService } from 'src/common/common.service';

@Injectable()
export class PapersService {
  constructor(
    @InjectRepository(Papers)
    private readonly papersRepository: Repository<Papers>,
    private readonly commonService: CommonService,

  ){}
  async getAllPapers(dto: GetPapersDto) {

    const {title} = dto;

    const qb = await this.papersRepository.createQueryBuilder('paper')

    if(title){
      qb.where('paper.title LIKE :title', {title: `%${title}%`});
    }

    const {nextCursor} = await this.commonService.pagination(qb, dto);

    let [data, count] = await qb.getManyAndCount();


    return { 
      data,
      nextCursor,
      count,
    }; 
  }

}
