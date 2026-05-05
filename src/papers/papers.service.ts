import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paper } from './entities/papers.entity';
import { In, QueryRunner, Repository } from 'typeorm';
import { GetPapersPaginationDto } from './dto/get-papers-pagination.dto';
import { CommonService } from 'src/common/common.service';
import { Author } from './entities/authors.entity';
import { UsersService } from 'src/users/users.service';
import { PaperBookmark } from './entities/paper-bookmarks.entity';
import { GetAuthorsPaginationDto } from './dto/get-authors-pagination.dto';

@Injectable()
export class PapersService {
  constructor(
    @InjectRepository(Paper)
    private readonly papersRepository: Repository<Paper>,
    @InjectRepository(Author)
    private readonly authorsRepository: Repository<Author>,
    private readonly usersService: UsersService,
    private readonly commonService: CommonService,
  ){}

  // 조건에 해당되는 모든 논문 가져오기(페이지네이션 적용)
  async getAllPapers(dto: GetPapersPaginationDto) {

    const { keyword, tags, yearRange, startDate, endDate } = dto;

    const qb = this.papersRepository.createQueryBuilder('paper')
      .leftJoinAndSelect('paper.authors', 'author')
      .leftJoinAndSelect('paper.researchFields', 'researchField')

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
      const currentYear = new Date(); // ex. 2026.05.01
      currentYear.setFullYear(currentYear.getFullYear() - yearRange); // ex. 2023
      const startYear = currentYear.toISOString().split('T')[0]; // "2023.05.01T00:00:00.000Z" -> "2023-05-01"
      qb.andWhere('paper.publishedDate >= :start', { start: startYear });
    }else{
      // 직접 기간 설정
      if (startDate) {
        qb.andWhere('paper.publishedDate >= :startDate', { startDate });

        const effectiveEndDate = endDate ?? new Date().toISOString().split('T')[0];

        qb.andWhere('paper.publishedDate <= :endDate', {endDate: effectiveEndDate});

      } else if (endDate) {
        qb.andWhere('paper.publishedDate <= :endDate', { endDate });
      }
    }

    // 커서 기반 페이지네이션
    return this.commonService.cursorPagination(qb, dto);

    // // 페이지 기반 페이지네이션
    // return this.commonService.pagePagination(qb, dto);

  }

  // arxivId 기반 단일 논문 GET
  async getPaperByArxivId(arxivId: string){
    const paper = await this.papersRepository.findOne({
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
  async getAllAuthors(dto:GetAuthorsPaginationDto){
    
    const qb = this.authorsRepository.createQueryBuilder('author')

    return this.commonService.cursorPagination(qb, dto);
  }

  // 북마크 기능
  async togglePaperBookmark(arxivId: string, userId: number, qr: QueryRunner){
    const papersRepository = qr.manager.getRepository<Paper>(Paper);
    const paperbookmarksRepository = qr.manager.getRepository<PaperBookmark>(PaperBookmark);


    const paper = await papersRepository.findOne({
      where: {
        arxivId,
      }
    });

    if(!paper){
      throw new BadRequestException('존재하지 않는 논문입니다!');
    }

    const user = await this.usersService.findUserById(userId)

    if(!user){
      throw new NotFoundException('사용자 정보가 없습니다');
    }

    const bookmarkRecord = await paperbookmarksRepository.findOne({
      where: { paper: { arxivId }, user: { id: userId } },
    });

    // 테스크 스케줄링도 적용 예정
    if(bookmarkRecord){ // bookmark였는데 그냥 bookmark버튼 눌러서 북마크 취소
        await paperbookmarksRepository.delete({
          paper: { arxivId },
          user: { id: userId },
        });

        await papersRepository.decrement({
            arxivId, 
          }, 'bookmarkCount', 1);

        return { isBookmark: false };

    }else{ // bookmark아니었는데 bookmark 버튼 눌러서 북마크 표시
      await paperbookmarksRepository.save({
        paper,
        user, 
      })

      await papersRepository.increment({ 
        arxivId, 
      }, 'bookmarkCount', 1);

      return { isBookmark: true };
    }

  }


  // 논문 삭제 (arxivId 목록 또는 날짜 범위)
  async deletePapers(arxivIds?: string, startDate?: string, endDate?: string) {
    if (!arxivIds && !startDate && !endDate) {
      throw new BadRequestException('arxivIds 또는 날짜 범위(startDate/endDate)를 입력해주세요');
    }

    // ── 1. 삭제 대상 논문 조회 ──────────────────────────────────────────────
    let papersToDelete: Paper[];

    if (arxivIds) {
      const ids = arxivIds.trim().split(/\s+/);
      papersToDelete = await this.papersRepository.find({
        where: { arxivId: In(ids) },
        relations: { authors: true },
      });
    } else {
      const qb = this.papersRepository.createQueryBuilder('paper')
        .leftJoinAndSelect('paper.authors', 'author');
      if (startDate) qb.andWhere('paper.publishedDate >= :startDate', { startDate });
      if (endDate)   qb.andWhere('paper.publishedDate <= :endDate', { endDate });
      papersToDelete = await qb.getMany();
    }

    if (papersToDelete.length === 0) return { deleted: 0, authorsDeleted: 0 };

    // ── 2. 삭제 대상 저자 ID 수집 ────────────────────────────────────────────
    const authorIds = [...new Set(papersToDelete.flatMap((p) => p.authors.map((a) => a.id)))];

    // ── 3. 논문 삭제 (북마크/aiSummary는 onDelete: CASCADE로 자동 처리, ManyToMany 조인 테이블도 cascade: true로 자동 처리)
    await this.papersRepository.remove(papersToDelete);

    // ── 4. 고아 저자 정리 — 삭제된 논문에 속했던 저자 중 다른 논문이 없는 저자만 삭제
    let authorsDeleted = 0;
    if (authorIds.length > 0) {
      const orphaned = await this.authorsRepository
        .createQueryBuilder('author')
        .leftJoin('author.papers', 'paper')
        .where('author.id IN (:...ids)', { ids: authorIds })
        .andWhere('paper.arxivId IS NULL')
        .getMany();

      if (orphaned.length > 0) {
        await this.authorsRepository.remove(orphaned);
        authorsDeleted = orphaned.length;
      }
    }

    return { deleted: papersToDelete.length, authorsDeleted };
  }

}
