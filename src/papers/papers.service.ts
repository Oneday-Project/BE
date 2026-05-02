import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Papers } from './entities/papers.entity';
import { Repository } from 'typeorm';
import { GetPapersDto } from './dto/get-papers.dto';
import { CommonService } from 'src/common/common.service';
import { Category } from './entities/category.entity';
import { Author } from './entities/author.entity';

@Injectable()
export class PapersService {
  constructor(
    @InjectRepository(Papers)
    private readonly papersRepository: Repository<Papers>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Author)
    private readonly authorsRepository: Repository<Author>,
    private readonly commonService: CommonService,
  ){}

  async getAllPapers(dto: GetPapersDto) {

    const { keyword, tags } = dto;

    const qb = this.papersRepository.createQueryBuilder('paper')
      .leftJoinAndSelect('paper.authors', 'author')
      .leftJoinAndSelect('paper.categories', 'category');

    if (tags && tags.length > 0) {
      const tagSubQb = this.papersRepository.createQueryBuilder('paper')
        .select('paper."arxivId"')
        .leftJoin('paper.categories', 'category')
        .where('category.name IN (:...tags)', { tags })
        .distinct(true);
  
      // getQuery() - QueryBuilder를 "SQL문(문자열)"으로 바꿔주는 함수
      // :keyword, :...tags 와 같은 파라미터는 포함되지 않으므로(쿼리만 가져오고 값은 안 가져옴)
      // .setParameters() 사용 - SQL에 들어갈 변수 값들을 세팅하는 함수
      // qb.getParameters() - 메인 QueryBuilder에 이미 들어있는 파라미터들 가져오기({ year: 2024 })
      // tagSubQb.getParameters() - 서브쿼리에서 사용한 파라미터 가져오기({ tags: ['AI', 'ML'] })
      qb.andWhere(`paper."arxivId" IN (${tagSubQb.getQuery()})`)
        .setParameters({ ...qb.getParameters(), ...tagSubQb.getParameters() });
    }

    if (keyword) {
      const keywordSubQb = this.papersRepository.createQueryBuilder('paper')
        .select('paper."arxivId"')
        .leftJoin('paper.authors', 'author')
        .where(
          `(paper.title ILIKE :keyword OR paper.abstract ILIKE :keyword OR author.name ILIKE :keyword)`,
          { keyword: `%${keyword}%` },
        )
        .distinct(true);

      qb.andWhere(`paper."arxivId" IN (${keywordSubQb.getQuery()})`)
        .setParameters({ ...qb.getParameters(), ...keywordSubQb.getParameters() });
    }

    // 커서 기반 페이지네이션
    return this.commonService.cursorPagination(qb, dto);

    // // 페이지 기반 페이지네이션
    // return this.commonService.pagePagination(qb, dto);

  }

  // async getPaperByArxivId(){

  // }

  async getAllCategories(){
    return this.categoriesRepository.find();
  }

  async getAllAuthors(){
    return this.authorsRepository.find();
  }

  async createCategory(name: string){
    const category = this.categoriesRepository.create({name});

    return this.categoriesRepository.save(category);
  }

}
