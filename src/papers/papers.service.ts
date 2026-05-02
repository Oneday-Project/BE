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

    const qb = this.papersRepository.createQueryBuilder('paper')

    if(title){
      qb.where('paper.title LIKE :title', {title: `%${title}%`});
    }

    // 커서 기반 페이지네이션
    return this.commonService.cursorPagination(qb, dto);

    // // 페이지 기반 페이지네이션
    // return this.commonService.pagePagination(qb, dto);

  }
}
