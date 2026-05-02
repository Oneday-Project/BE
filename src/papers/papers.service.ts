import { Injectable, NotFoundException } from '@nestjs/common';
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

  // 조건에 해당되는 모든 논문 가져오기(페이지네이션 적용)
  async getAllPapers(dto: GetPapersDto) {

    const { keyword, tags, yearRange, startDate, endDate } = dto;

    const qb = this.papersRepository.createQueryBuilder('paper')
      .leftJoinAndSelect('paper.authors', 'author')
      .leftJoinAndSelect('paper.categories', 'category');

    // 분야로 검색하는 기능
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

    // 검색창 기능(검색창에 특정 단어를 검색하면 논문 제목, 초록, 저자에서 찾아서 논문 검색)
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

    // 최근 몇년으로 검색하는 기능
    if (yearRange) { // yearRange = 3
      const from = new Date(); // ex. 2026.05.01
      from.setFullYear(from.getFullYear() - yearRange); // ex. 2023
      const fromStr = from.toISOString().split('T')[0]; // "2023.05.01T00:00:00.000Z" -> "2023-05-01"
      qb.andWhere('paper.publishedDate >= :from', { from: fromStr });
    }

    // 직접 기간 설정
    if (startDate) {
      qb.andWhere('paper.publishedDate >= :startDate', { startDate });
    }

    // 직접 기간 설정
    if (endDate) {
      qb.andWhere('paper.publishedDate <= :endDate', { endDate });
    }


    // 커서 기반 페이지네이션
    return this.commonService.cursorPagination(qb, dto);

    // // 페이지 기반 페이지네이션
    // return this.commonService.pagePagination(qb, dto);

  }

  // arxivId 기반 단일 논문 GET
  async getPaperByArxivId(arxivId: string){
    const paper = this.papersRepository.findOne({
      where: {
        arxivId,
      },
      relations: {
        authors: true,
        categories: true,
        aiSummary: true,
      }
    })

    if(!paper){
      throw new NotFoundException('존재하지 않는 논문입니다!');
    }

    return paper;
  }



  // 모든 분야 GET
  async getAllCategories(){
    return this.categoriesRepository.find();
  }

  // 모든 저자 GET
  async getAllAuthors(){
    return this.authorsRepository.find();
  }

  // 분야 생성
  async createCategory(name: string){
    const category = this.categoriesRepository.create({name});

    return this.categoriesRepository.save(category);
  }

}
