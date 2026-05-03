import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paper } from './entities/papers.entity';
import { Repository } from 'typeorm';
import { GetPapersDto } from './dto/get-papers.dto';
import { CommonService } from 'src/common/common.service';
import { Author } from './entities/authors.entity';
import { UsersService } from 'src/users/users.service';
import { PaperBookmark } from './entities/paper-bookmarks.entity';

@Injectable()
export class PapersService {
  constructor(
    @InjectRepository(Paper)
    private readonly papersRepository: Repository<Paper>,
    @InjectRepository(Author)
    private readonly authorsRepository: Repository<Author>,
    @InjectRepository(PaperBookmark)
    private readonly paperbookmarksRepository: Repository<PaperBookmark>,
    private readonly usersService: UsersService,
    private readonly commonService: CommonService,
  ){}

  // 조건에 해당되는 모든 논문 가져오기(페이지네이션 적용)
  async getAllPapers(dto: GetPapersDto) {

    const { keyword, tags, yearRange, startDate, endDate } = dto;

    const qb = this.papersRepository.createQueryBuilder('paper')
      .leftJoinAndSelect('paper.authors', 'author')
      .leftJoinAndSelect('paper.researchFields', 'researchField');

    // 분야로 검색하는 기능
    if (tags && tags.length > 0) {
      const tagSubQb = this.papersRepository.createQueryBuilder('paper')
        .select('paper."arxivId"')
        .leftJoin('paper.researchFields', 'researchField')
        .where('researchField.name IN (:...tags)', { tags })
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
        researchFields: true,
        aiSummary: true,
      }
    })

    if(!paper){
      throw new NotFoundException('존재하지 않는 논문입니다!');
    }

    return paper;
  }


  // 모든 저자 GET
  async getAllAuthors(){
    return this.authorsRepository.find();
  }


  async togglePaperBookmark(arxivId: string, userId: number){
    const paper = await this.papersRepository.findOne({
      where: {
        arxivId,
      }
    });

    if(!paper){
      throw new BadRequestException('존재하지 않는 논문입니다!');
    }

    const user = await this.usersService.findUserById(userId)

    if(!user){
      throw new UnauthorizedException('사용자 정보가 없습니다');
    }

    const bookmarkRecord = await this.paperbookmarksRepository.findOne({
      where: { paper: { arxivId }, user: { id: userId } },
    });

    if(bookmarkRecord){ // bookmark였는데 그냥 bookmark버튼 눌러서 북마크 취소
        await this.paperbookmarksRepository.delete({
          paper: { arxivId },
          user: { id: userId },
        });
        return { isBookmark: false };
    }else{ // 애초에 데이터가 없었다면 새로 생성
      await this.paperbookmarksRepository.save({
        paper,
        user, 
      })
      return { isBookmark: true };
    }

  }



}
