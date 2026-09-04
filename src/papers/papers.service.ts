import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Paper } from './entities/papers.entity';
import { In, LessThan, QueryFailedError, QueryRunner, Repository } from 'typeorm';
import { GetPapersPaginationDto } from './dto/get-papers-pagination.dto';
import { CommonService } from 'src/common/common.service';
import { Author } from './entities/authors.entity';
import { PaperBookmark } from './entities/paper-bookmarks.entity';
import {
  PaperReadingStatus,
  ReadingStatusEnum,
} from './entities/paper-reading-status.entity';
import { ReadingActivityLog } from './entities/reading-activity-log.entity';
import { HaiPaper } from './entities/hai-papers.entity';
import { HaiPaperBookmark } from './entities/hai-paper-bookmarks.entity';
import { HaiPaperReadingStatus } from './entities/hai-paper-reading-status.entity';
import { HaiPaperActivityLog } from './entities/hai-paper-activity-log.entity';
import { GetAuthorsPaginationDto } from './dto/get-authors-pagination.dto';
import { GetReadingCalendarDto } from './dto/get-reading-calendar.dto';
import { GetLibraryDto, LibraryTypeEnum } from './dto/get-library.dto';

@Injectable()
export class PapersService {
  // '읽는 중' 상태가 이 시간(30일)을 넘기면 만료(안읽음)로 취급
  private readonly READING_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(Paper)
    private readonly papersRepository: Repository<Paper>,
    @InjectRepository(Author)
    private readonly authorsRepository: Repository<Author>,
    @InjectRepository(PaperBookmark)
    private readonly paperBookmarkRepository: Repository<PaperBookmark>,
    @InjectRepository(PaperReadingStatus)
    private readonly paperReadingStatusRepository: Repository<PaperReadingStatus>,
    @InjectRepository(ReadingActivityLog)
    private readonly readingActivityLogRepository: Repository<ReadingActivityLog>,
    @InjectRepository(HaiPaper)
    private readonly haiPapersRepository: Repository<HaiPaper>,
    @InjectRepository(HaiPaperBookmark)
    private readonly haiPaperBookmarkRepository: Repository<HaiPaperBookmark>,
    @InjectRepository(HaiPaperReadingStatus)
    private readonly haiPaperReadingStatusRepository: Repository<HaiPaperReadingStatus>,
    @InjectRepository(HaiPaperActivityLog)
    private readonly haiPaperActivityLogRepository: Repository<HaiPaperActivityLog>,
    private readonly commonService: CommonService,
  ) {}

  // 조건에 해당되는 모든 논문 가져오기(페이지네이션 적용)
  // userId가 주어지면(로그인한 유저의 API 호출) 카드마다 북마크 여부/읽기상태를 함께 반환한다.
  // 비로그인(게스트) 호출 시에는 userId가 undefined이며, 이 경우 개인화 데이터 없이 논문 목록만 반환한다.
  async getAllPapers(dto: GetPapersPaginationDto, userId?: number) {
    const { keyword, tags, yearRange, startDate, endDate, starTier } = dto;

    const qb = this.papersRepository
      .createQueryBuilder('paper')
      .leftJoinAndSelect('paper.authors', 'author')
      .leftJoinAndSelect('paper.researchFields', 'researchField');

    // 분야로 검색하는 기능
    if (tags && tags.length > 0) {
      const tagSubQb = this.papersRepository
        .createQueryBuilder('paper')
        .select('paper."arxivId"')
        .leftJoin('paper.researchFields', 'researchField')
        .where('researchField.tag IN (:...tags)', { tags })
        .distinct(true);

      // getQuery() - QueryBuilder를 "SQL문(문자열)"으로 바꿔주는 함수
      // :keyword, :...tags 와 같은 파라미터는 포함되지 않으므로(쿼리만 가져오고 값은 안 가져옴)
      // .setParameters() 사용 - SQL에 들어갈 변수 값들을 세팅하는 함수
      // qb.getParameters() - 메인 QueryBuilder에 이미 들어있는 파라미터들 가져오기({ year: 2024 })
      // tagSubQb.getParameters() - 서브쿼리에서 사용한 파라미터 가져오기({ tags: ['AI', 'ML'] })
      qb.andWhere(`paper."arxivId" IN (${tagSubQb.getQuery()})`).setParameters({
        ...qb.getParameters(),
        ...tagSubQb.getParameters(),
      });
    }

    // 검색창 기능(검색창에 특정 단어를 검색하면 논문 제목, 초록, 저자에서 찾아서 논문 검색)
    if (keyword) {
      const keywordSubQb = this.papersRepository
        .createQueryBuilder('paper')
        .select('paper."arxivId"')
        .leftJoin('paper.authors', 'author')
        .where(
          `(paper.title ILIKE :keyword OR paper.abstract ILIKE :keyword OR author.name ILIKE :keyword)`,
          { keyword: `%${keyword}%` },
        )
        .distinct(true);

      qb.andWhere(
        `paper."arxivId" IN (${keywordSubQb.getQuery()})`,
      ).setParameters({
        ...qb.getParameters(),
        ...keywordSubQb.getParameters(),
      });
    }

    // 최근 몇년으로 검색하는 기능
    if (yearRange) {
      // yearRange = 3
      const currentYear = new Date(); // ex. 2026.05.01
      currentYear.setFullYear(currentYear.getFullYear() - yearRange); // ex. 2023
      const startYear = currentYear.toISOString().split('T')[0]; // "2023.05.01T00:00:00.000Z" -> "2023-05-01"
      qb.andWhere('paper.publishedDate >= :start', { start: startYear });
    } else {
      // 직접 기간 설정
      if (startDate) {
        qb.andWhere('paper.publishedDate >= :startDate', { startDate });

        const effectiveEndDate =
          endDate ?? new Date().toISOString().split('T')[0];

        qb.andWhere('paper.publishedDate <= :endDate', {
          endDate: effectiveEndDate,
        });
      } else if (endDate) {
        qb.andWhere('paper.publishedDate <= :endDate', { endDate });
      }
    }

    // 별점 티어(중요도)로 검색하는 기능
    if (starTier) {
      qb.andWhere('paper.starTier = :starTier', { starTier });
    }

    // 읽기 완료한 논문 포함 여부(로그인 시에만 적용 — 게스트는 완료 상태를 알 수 없으므로 무시)
    if (dto.includeCompleted === false && userId !== undefined) {
      const completedSubQb = this.paperReadingStatusRepository
        .createQueryBuilder('status')
        .select('status."paperId"')
        .where('status."userId" = :excludeCompletedUserId', {
          excludeCompletedUserId: userId,
        })
        .andWhere('status.status = :completedStatus', {
          completedStatus: ReadingStatusEnum.COMPLETED,
        });

      qb.andWhere(
        `paper."arxivId" NOT IN (${completedSubQb.getQuery()})`,
      ).setParameters({
        ...qb.getParameters(),
        ...completedSubQb.getParameters(),
      });
    }

    // 커서 기반 페이지네이션
    const result = await this.commonService.cursorPagination(qb, dto);

    // // 페이지 기반 페이지네이션
    // return this.commonService.pagePagination(qb, dto);

    // researchFields는 tag 문자열 배열로, authors는 이름 문자열 배열로 단순화
    const papersWithTags = result.data.map((paper) => ({
      ...paper,
      researchFields: paper.researchFields
        .filter((f) => f.tag)
        .map((f) => f.tag),
      authors: paper.authors.map((a) => a.name),
    }));

    if (userId === undefined || papersWithTags.length === 0) {
      return { ...result, data: papersWithTags };
    }

    const arxivIds = papersWithTags.map((p) => p.arxivId);

    const [bookmarks, statuses] = await Promise.all([
      this.paperBookmarkRepository.find({
        where: { userId, paperId: In(arxivIds) },
      }),
      this.paperReadingStatusRepository.find({
        where: { userId, paperId: In(arxivIds) },
      }),
    ]);

    const bookmarkedSet = new Set(bookmarks.map((b) => b.paperId));
    const statusMap = new Map(statuses.map((s) => [s.paperId, s]));

    const data = papersWithTags.map((paper) => {
      const status = statusMap.get(paper.arxivId);
      const readingStatus =
        !status || (status.status === ReadingStatusEnum.READING && this.isExpiredReading(status))
          ? 'unread'
          : status.status;

      return {
        ...paper,
        isBookmark: bookmarkedSet.has(paper.arxivId),
        readingStatus,
      };
    });

    return { ...result, data };
  }

  // arxivId 기반 단일 논문 GET
  // userId가 주어지면(로그인한 유저의 API 호출) 해당 유저 기준 읽기 상태를 함께 반환한다.
  // 배치/관리자 로직 등 유저 컨텍스트가 없는 내부 호출에서는 userId 없이 논문 정보만 조회한다.
  async getPaperByArxivId(arxivId: string, userId?: number) {
    const paper = await this.papersRepository.findOne({
      where: {
        arxivId,
      },
      relations: {
        authors: true,
        researchFields: true,
        aiSummary: true,
      },
    });

    if (!paper) {
      throw new NotFoundException('존재하지 않는 논문입니다!');
    }

    // researchFields는 tag 문자열 배열로, authors는 이름 문자열 배열로 단순화
    const paperWithTags = {
      ...paper,
      researchFields: paper.researchFields
        .filter((f) => f.tag)
        .map((f) => f.tag),
      authors: paper.authors.map((a) => a.name),
    };

    if (userId === undefined) {
      return paperWithTags;
    }

    const [readingStatus, bookmark] = await Promise.all([
      this.resolveReadingStatus(arxivId, userId),
      this.paperBookmarkRepository.findOne({
        where: { paperId: arxivId, userId },
      }),
    ]);

    return { ...paperWithTags, isBookmark: !!bookmark, readingStatus };
  }

  // 모든 저자 GET
  async getAllAuthors(dto: GetAuthorsPaginationDto) {
    const qb = this.authorsRepository.createQueryBuilder('author');

    return this.commonService.cursorPagination(qb, dto);
  }

  // 북마크 기능
  async togglePaperBookmark(arxivId: string, userId: number, qr: QueryRunner) {
    const papersRepository = qr.manager.getRepository<Paper>(Paper);
    const paperbookmarksRepository =
      qr.manager.getRepository<PaperBookmark>(PaperBookmark);

    // 존재 여부만 확인하면 되므로 exists 사용(findOne이면 abstract까지 통째로 읽어온다)
    const paperExists = await papersRepository.exists({
      where: {
        arxivId,
      },
    });

    if (!paperExists) {
      throw new NotFoundException('존재하지 않는 논문입니다!');
    }

    const bookmarkRecord = await paperbookmarksRepository.findOne({
      where: { paper: { arxivId }, user: { id: userId } },
    });

    // 테스크 스케줄링도 적용 예정
    if (bookmarkRecord) {
      // bookmark였는데 그냥 bookmark버튼 눌러서 북마크 취소
      const deleteResult = await paperbookmarksRepository.delete({
        paper: { arxivId },
        user: { id: userId },
      });

      // 동시에 들어온 중복 요청(더블클릭 등)이 이미 지웠다면 delete는 에러 없이 0건으로 끝난다.
      // 그때도 decrement를 돌려버리면 실제로는 1명이 취소했는데 카운트만 2 줄어들어
      // bookmarkCount가 실제 북마크 수보다 작아진다(음수까지 내려갈 수 있음).
      // 그래서 실제로 지워졌을 때만 카운트를 내린다.
      if (deleteResult.affected) {
        await papersRepository.decrement(
          {
            arxivId,
          },
          'bookmarkCount',
          1,
        );
      }

      return { isBookmark: false };
    } else {
      // bookmark아니었는데 bookmark 버튼 눌러서 북마크 표시
      try {
        // 관계 객체 대신 PK 컬럼만 넣어 저장한다(엔티티에 paperId/userId가 그대로 있음).
        // 유저를 다시 조회할 필요가 없어져 북마크 토글에서 쿼리 하나가 통째로 빠진다.
        // (유저 존재 여부는 AccessTokenGuard가 이미 확인했고, FK 제약이 최후 방어선이다)
        await paperbookmarksRepository.save({
          paperId: arxivId,
          userId,
        });
      } catch (e) {
        // 동시에 들어온 중복 요청(더블클릭 등)이 한 발 먼저 넣었다면 PK 중복 에러가 난다.
        // 충돌이 보인다는 건 상대 요청이 이미 커밋됐다는 뜻이므로,
        // 사용자가 원한 결과("북마크 켜짐")는 이미 이뤄진 상태다. 500 대신 성공으로 응답한다.
        // 카운트도 먼저 성공한 요청이 이미 올렸으므로 여기서 또 올리지 않는다.
        if (this.isUniqueViolation(e)) {
          return { isBookmark: true };
        }
        throw e;
      }

      await papersRepository.increment(
        {
          arxivId,
        },
        'bookmarkCount',
        1,
      );

      return { isBookmark: true };
    }
  }

  // 읽는 중 상태 토글(시작/취소)
  async toggleReadingStatus(arxivId: string, userId: number, qr: QueryRunner) {
    const papersRepository = qr.manager.getRepository<Paper>(Paper);
    const paperReadingStatusRepository =
      qr.manager.getRepository<PaperReadingStatus>(PaperReadingStatus);
    const readingActivityLogRepository =
      qr.manager.getRepository<ReadingActivityLog>(ReadingActivityLog);

    // 존재 여부만 확인하면 되므로 exists 사용(findOne이면 abstract까지 통째로 읽어온다)
    const paperExists = await papersRepository.exists({ where: { arxivId } });
    if (!paperExists) {
      throw new NotFoundException('존재하지 않는 논문입니다!');
    }

    let existing = await paperReadingStatusRepository.findOne({
      where: { paperId: arxivId, userId },
    });

    // 30일 지난 '읽는 중' 상태는 이미 안읽음으로 취급 -> row를 지우고 없던 것처럼 처리(취소가 아니라 새로 시작하게)
    if (
      existing &&
      existing.status === ReadingStatusEnum.READING &&
      this.isExpiredReading(existing)
    ) {
      await paperReadingStatusRepository.delete({ paperId: arxivId, userId });
      existing = null;
    }

    if (existing) {
      if (existing.status === ReadingStatusEnum.COMPLETED) {
        throw new ConflictException('이미 읽기 완료된 논문입니다.');
      }

      // 읽는 중 -> 안읽음(취소)
      await paperReadingStatusRepository.delete({ paperId: arxivId, userId });

      // 오늘 접속으로 자동 기록됐을 활동 로그만 롤백(과거 날짜 로그는 보존)
      await readingActivityLogRepository.delete({
        paperId: arxivId,
        userId,
        date: this.today(),
      });

      return { status: 'unread' };
    }

    // 안읽음 -> 읽는 중
    try {
      await paperReadingStatusRepository.save({
        paperId: arxivId,
        userId,
        status: ReadingStatusEnum.READING,
        startedAt: new Date(),
        completedAt: null,
      });

      await readingActivityLogRepository.save({
        paperId: arxivId,
        userId,
        date: this.today(),
      });
    } catch (e) {
      // 동시에 들어온 중복 요청(더블클릭 등)이 한 발 먼저 넣었다면 PK 중복 에러가 난다.
      // 충돌이 보인다는 건 상대 요청이 이미 커밋됐다는 뜻이라 '읽는 중'은 이미 기록된 상태이고,
      // 어차피 같은 값을 넣으려던 것이므로 500 대신 의도한 결과를 그대로 응답한다.
      if (this.isUniqueViolation(e)) {
        return { status: 'reading' };
      }
      throw e;
    }

    return { status: 'reading' };
  }

  // 읽기 완료로 전환
  async completeReading(arxivId: string, userId: number, qr: QueryRunner) {
    const paperReadingStatusRepository =
      qr.manager.getRepository<PaperReadingStatus>(PaperReadingStatus);
    const readingActivityLogRepository =
      qr.manager.getRepository<ReadingActivityLog>(ReadingActivityLog);

    const existing = await paperReadingStatusRepository.findOne({
      where: { paperId: arxivId, userId },
    });

    if (!existing) {
      throw new NotFoundException(
        '읽는 중인 논문이 아닙니다. 먼저 읽는 중으로 표시해주세요.',
      );
    }

    if (existing.status === ReadingStatusEnum.COMPLETED) {
      throw new ConflictException('이미 읽기 완료된 논문입니다.');
    }

    // 30일 지난 '읽는 중' 상태는 이미 안읽음으로 취급 -> 완료 처리 대신 만료 정리 후 동일한 에러
    if (this.isExpiredReading(existing)) {
      await paperReadingStatusRepository.delete({ paperId: arxivId, userId });
      throw new NotFoundException(
        '읽는 중인 논문이 아닙니다. 먼저 읽는 중으로 표시해주세요.',
      );
    }

    existing.status = ReadingStatusEnum.COMPLETED;
    existing.completedAt = new Date();
    await paperReadingStatusRepository.save(existing);

    await readingActivityLogRepository.save({
      paperId: arxivId,
      userId,
      date: this.today(),
    });

    return { status: 'completed' };
  }

  // 읽기 상태 조회 + 30일 지연 만료 처리 + 활동 로그 기록
  private async resolveReadingStatus(
    arxivId: string,
    userId: number,
  ): Promise<'unread' | 'reading' | 'completed'> {
    const status = await this.paperReadingStatusRepository.findOne({
      where: { paperId: arxivId, userId },
    });

    if (!status) return 'unread';

    if (status.status === ReadingStatusEnum.READING) {
      if (this.isExpiredReading(status)) {
        await this.paperReadingStatusRepository.delete({
          paperId: arxivId,
          userId,
        });
        return 'unread';
      }

      await this.logReadingActivity(arxivId, userId);
    }

    return status.status;
  }

  // '읽는 중' 상태가 30일 만료 기준을 넘겼는지 확인 (completed 여부는 호출부에서 이미 걸러졌다고 가정)
  private isExpiredReading(status: PaperReadingStatus): boolean {
    return Date.now() - status.startedAt.getTime() > this.READING_EXPIRY_MS;
  }

  // 고유키(PK/unique) 중복 위반인지 확인 — 동시에 들어온 중복 요청이
  // 같은 행을 두 번 넣으려 할 때 PostgreSQL이 23505 코드로 알려준다
  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as { code?: string };
    return driverError?.code === '23505';
  }

  // 이 유저의 '읽는 중' 상태 중 30일 지난 것들을 한꺼번에 정리(만료 처리) — arxiv 논문 + HAI 논문 둘 다
  // 캘린더/이어서읽기처럼 여러 논문을 한꺼번에 집계하는 API 진입 시점에 호출해서,
  // 개별 논문 상세조회를 안 거쳐도 집계 결과에 만료된 항목이 남아있지 않게 한다.
  private async expireStaleReadingStatuses(userId: number): Promise<void> {
    const expiryThreshold = new Date(Date.now() - this.READING_EXPIRY_MS);

    await this.paperReadingStatusRepository.delete({
      userId,
      status: ReadingStatusEnum.READING,
      startedAt: LessThan(expiryThreshold),
    });

    await this.haiPaperReadingStatusRepository.delete({
      userId,
      status: ReadingStatusEnum.READING,
      startedAt: LessThan(expiryThreshold),
    });
  }

  // 오늘 날짜 활동 로그 upsert(이미 있으면 무시)
  private async logReadingActivity(arxivId: string, userId: number) {
    const date = this.today();

    const exists = await this.readingActivityLogRepository.exists({
      where: { paperId: arxivId, userId, date },
    });

    if (!exists) {
      await this.readingActivityLogRepository.save({
        paperId: arxivId,
        userId,
        date,
      });
    }
  }

  // 월간 캘린더/요약/연속기록 조회 (arxiv 논문 + HAI 논문 통합)
  async getReadingCalendar(userId: number, dto: GetReadingCalendarDto) {
    await this.expireStaleReadingStatuses(userId); // 집계 전에 30일 지난 읽는 중 상태부터 정리

    const { year, month } = dto;
    const monthStr = String(month).padStart(2, '0');
    const yearMonth = `${year}-${monthStr}`;
    const startDate = `${yearMonth}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

    // 연한 파랑: 활동 로그가 있는 날짜들 (두 소스를 합침)
    const [paperActivityRows, haiActivityRows] = await Promise.all([
      this.readingActivityLogRepository
        .createQueryBuilder('log')
        .select("DISTINCT TO_CHAR(log.date, 'YYYY-MM-DD')", 'date')
        .where('log.userId = :userId', { userId })
        .andWhere('log.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .getRawMany<{ date: string }>(),
      this.haiPaperActivityLogRepository
        .createQueryBuilder('log')
        .select("DISTINCT TO_CHAR(log.date, 'YYYY-MM-DD')", 'date')
        .where('log.userId = :userId', { userId })
        .andWhere('log.date BETWEEN :startDate AND :endDate', {
          startDate,
          endDate,
        })
        .getRawMany<{ date: string }>(),
    ]);

    const activityDateSet = new Set([
      ...paperActivityRows.map((r) => r.date),
      ...haiActivityRows.map((r) => r.date),
    ]);

    // 진한 파랑: 완료된 날짜들 (completed_at은 timestamptz이므로 한국시간(KST)으로 변환 후 날짜만 비교, 두 소스를 합침)
    const [paperCompletedRows, haiCompletedRows] = await Promise.all([
      this.paperReadingStatusRepository
        .createQueryBuilder('status')
        .select(
          "DISTINCT TO_CHAR(status.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')",
          'date',
        )
        .where('status.userId = :userId', { userId })
        .andWhere('status.completed_at IS NOT NULL')
        .andWhere(
          "TO_CHAR(status.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') BETWEEN :startDate AND :endDate",
          { startDate, endDate },
        )
        .getRawMany<{ date: string }>(),
      this.haiPaperReadingStatusRepository
        .createQueryBuilder('status')
        .select(
          "DISTINCT TO_CHAR(status.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD')",
          'date',
        )
        .where('status.userId = :userId', { userId })
        .andWhere('status.completed_at IS NOT NULL')
        .andWhere(
          "TO_CHAR(status.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') BETWEEN :startDate AND :endDate",
          { startDate, endDate },
        )
        .getRawMany<{ date: string }>(),
    ]);

    const completedDateSet = new Set([
      ...paperCompletedRows.map((r) => r.date),
      ...haiCompletedRows.map((r) => r.date),
    ]);

    const days: { date: string; status: 'reading' | 'completed' }[] = [
      ...activityDateSet,
    ].map((date) => ({
      date,
      status: completedDateSet.has(date) ? 'completed' : 'reading',
    }));

    for (const date of completedDateSet) {
      if (!days.some((d) => d.date === date)) {
        days.push({ date, status: 'completed' });
      }
    }

    // "이번 달에 시작한 개수"가 아니라 "지금 이 순간 읽는 중(완료 안 된) 상태인 개수" — 월과 무관하게 실시간 값, 두 소스 합산
    const [paperReadingCount, haiReadingCount] = await Promise.all([
      this.paperReadingStatusRepository.count({
        where: { userId, status: ReadingStatusEnum.READING },
      }),
      this.haiPaperReadingStatusRepository.count({
        where: { userId, status: ReadingStatusEnum.READING },
      }),
    ]);
    const readingCount = paperReadingCount + haiReadingCount;

    const [paperCompletedCount, haiCompletedCount] = await Promise.all([
      this.paperReadingStatusRepository
        .createQueryBuilder('status')
        .where('status.userId = :userId', { userId })
        .andWhere('status.completed_at IS NOT NULL')
        .andWhere(
          "TO_CHAR(status.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') = :yearMonth",
          { yearMonth },
        )
        .getCount(),
      this.haiPaperReadingStatusRepository
        .createQueryBuilder('status')
        .where('status.userId = :userId', { userId })
        .andWhere('status.completed_at IS NOT NULL')
        .andWhere(
          "TO_CHAR(status.completed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM') = :yearMonth",
          { yearMonth },
        )
        .getCount(),
    ]);
    const completedCount = paperCompletedCount + haiCompletedCount;

    const streak = await this.calculateStreak(userId);

    return { year, month, days, readingCount, completedCount, streak };
  }

  // 오늘(또는 마지막 활동일)부터 거슬러 올라가며 활동이 끊기지 않고 이어진 일수 계산 (arxiv 논문 + HAI 논문 통합)
  private async calculateStreak(userId: number): Promise<number> {
    const [paperRows, haiRows] = await Promise.all([
      this.readingActivityLogRepository
        .createQueryBuilder('log')
        .select("DISTINCT TO_CHAR(log.date, 'YYYY-MM-DD')", 'date')
        .where('log.userId = :userId', { userId })
        .getRawMany<{ date: string }>(),
      this.haiPaperActivityLogRepository
        .createQueryBuilder('log')
        .select("DISTINCT TO_CHAR(log.date, 'YYYY-MM-DD')", 'date')
        .where('log.userId = :userId', { userId })
        .getRawMany<{ date: string }>(),
    ]);

    const dateSet = new Set([
      ...paperRows.map((r) => r.date),
      ...haiRows.map((r) => r.date),
    ]);

    if (dateSet.size === 0) return 0;

    const cursor = new Date();

    // 오늘 활동이 아직 없으면 어제부터 계산(오늘 하루가 안 끝났다고 스트릭이 끊기지 않게)
    if (!dateSet.has(this.toDateStr(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;
    while (dateSet.has(this.toDateStr(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  }

  // UTC가 아닌 한국시간(KST, UTC+9) 기준 날짜로 변환(자정~오전9시 사이 UTC 날짜가 하루 밀리는 것 방지)
  private toDateStr(date: Date): string {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    return new Date(date.getTime() + KST_OFFSET_MS).toISOString().split('T')[0];
  }

  private today(): string {
    return this.toDateStr(new Date());
  }

  // 마이페이지 라이브러리 목록 조회 (북마크/읽는 중/다 읽음, arxiv 논문 + HAI 논문 통합, 페이지네이션 적용)
  // 정렬 기준이 되는 (id, 날짜)만 먼저 가볍게 조회해서 병합/정렬/페이지 슬라이스한 뒤,
  // 그 페이지에 해당하는 논문만 상세 조회(하이드레이션)한다 — 매번 전체 논문 데이터를 불러오지 않기 위함.
  async getMyLibrary(userId: number, dto: GetLibraryDto) {
    const { type } = dto;
    const page = dto.page ?? 1;
    const take = dto.take;

    await this.expireStaleReadingStatuses(userId); // 목록 조회 전에 30일 지난 읽는 중 상태부터 정리

    type LibraryEntry = { id: string | number; date: Date };
    let paperEntries: LibraryEntry[];
    let haiEntries: LibraryEntry[];

    if (type === LibraryTypeEnum.BOOKMARK) {
      const [paperBookmarks, haiBookmarks] = await Promise.all([
        this.paperBookmarkRepository.find({ where: { userId } }),
        this.haiPaperBookmarkRepository.find({ where: { userId } }),
      ]);
      paperEntries = paperBookmarks.map((b) => ({ id: b.paperId, date: b.createdAt }));
      haiEntries = haiBookmarks.map((b) => ({ id: b.haiPaperId, date: b.createdAt }));
    } else {
      const status =
        type === LibraryTypeEnum.READING
          ? ReadingStatusEnum.READING
          : ReadingStatusEnum.COMPLETED;

      const [paperStatuses, haiStatuses] = await Promise.all([
        this.paperReadingStatusRepository.find({ where: { userId, status } }),
        this.haiPaperReadingStatusRepository.find({ where: { userId, status } }),
      ]);

      paperEntries = paperStatuses.map((s) => ({
        id: s.paperId,
        date: type === LibraryTypeEnum.READING ? s.startedAt : s.completedAt!,
      }));
      haiEntries = haiStatuses.map((s) => ({
        id: s.haiPaperId,
        date: type === LibraryTypeEnum.READING ? s.startedAt : s.completedAt!,
      }));
    }

    const merged = [
      ...paperEntries.map((e) => ({ ...e, source: 'paper' as const })),
      ...haiEntries.map((e) => ({ ...e, source: 'hai_paper' as const })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    const total = merged.length;
    const totalPages = Math.ceil(total / take);
    const pageItems = merged.slice((page - 1) * take, page * take);

    if (pageItems.length === 0) {
      return { data: [], total, totalPages, page };
    }

    const pageArxivIds = pageItems
      .filter((e) => e.source === 'paper')
      .map((e) => e.id as string);
    const pageHaiIds = pageItems
      .filter((e) => e.source === 'hai_paper')
      .map((e) => e.id as number);

    const [papers, haiPapers, paperBookmarksOnPage, haiBookmarksOnPage, paperStatusesOnPage, haiStatusesOnPage] =
      await Promise.all([
        pageArxivIds.length
          ? this.papersRepository.find({
              where: { arxivId: In(pageArxivIds) },
              relations: { researchFields: true },
            })
          : Promise.resolve([] as Paper[]),
        pageHaiIds.length
          ? this.haiPapersRepository.find({ where: { id: In(pageHaiIds) } })
          : Promise.resolve([] as HaiPaper[]),
        pageArxivIds.length
          ? this.paperBookmarkRepository.find({
              where: { userId, paperId: In(pageArxivIds) },
            })
          : Promise.resolve([] as PaperBookmark[]),
        pageHaiIds.length
          ? this.haiPaperBookmarkRepository.find({
              where: { userId, haiPaperId: In(pageHaiIds) },
            })
          : Promise.resolve([] as HaiPaperBookmark[]),
        pageArxivIds.length
          ? this.paperReadingStatusRepository.find({
              where: { userId, paperId: In(pageArxivIds) },
            })
          : Promise.resolve([] as PaperReadingStatus[]),
        pageHaiIds.length
          ? this.haiPaperReadingStatusRepository.find({
              where: { userId, haiPaperId: In(pageHaiIds) },
            })
          : Promise.resolve([] as HaiPaperReadingStatus[]),
      ]);

    const paperMap = new Map(papers.map((p) => [p.arxivId, p]));
    const haiPaperMap = new Map(haiPapers.map((p) => [p.id, p]));
    const bookmarkedSet = new Set(paperBookmarksOnPage.map((b) => b.paperId));
    const haiBookmarkedSet = new Set(haiBookmarksOnPage.map((b) => b.haiPaperId));
    const readingStatusMap = new Map(paperStatusesOnPage.map((s) => [s.paperId, s.status]));
    const haiReadingStatusMap = new Map(
      haiStatusesOnPage.map((s) => [s.haiPaperId, s.status]),
    );

    const data = pageItems
      .map((entry) => {
        if (entry.source === 'paper') {
          const paper = paperMap.get(entry.id as string);
          if (!paper) return null;
          return {
            type: 'paper' as const,
            id: paper.arxivId,
            title: paper.title,
            abstract: paper.abstract,
            publishedDate: paper.publishedDate,
            tags: paper.researchFields.filter((f) => f.tag).map((f) => f.tag),
            isBookmark: bookmarkedSet.has(paper.arxivId),
            readingStatus: readingStatusMap.get(paper.arxivId) ?? 'unread',
          };
        }

        const haiPaper = haiPaperMap.get(entry.id as number);
        if (!haiPaper) return null;
        return {
          type: 'hai_paper' as const,
          id: String(haiPaper.id),
          title: haiPaper.title,
          abstract: haiPaper.abstract,
          publishedDate: haiPaper.publishedYear,
          tags: haiPaper.researchFields ?? [],
          isBookmark: haiBookmarkedSet.has(haiPaper.id),
          readingStatus: haiReadingStatusMap.get(haiPaper.id) ?? 'unread',
        };
      }) 
      .filter((item): item is NonNullable<typeof item> => !!item);

    return { data, total, totalPages, page };
  }

  // 논문 starTier 일괄 계산 및 저장
  async assignStarTiers() {
    const fieldThresholds: Record<string, { star3: number; star2: number }> = {
      'cs.AI': { star3: 500, star2: 100 },
      'cs.LG': { star3: 500, star2: 100 },
      'cs.CV': { star3: 500, star2: 100 },
      'cs.CL': { star3: 500, star2: 100 },
      'stat.ML': { star3: 300, star2: 80 },
      'cs.IR': { star3: 50, star2: 20 },
      'cs.MM': { star3: 100, star2: 50 },
      'cs.SD': { star3: 200, star2: 40 },
      'cs.RO': { star3: 60, star2: 20 },
      'cs.SE': { star3: 80, star2: 15 },
      'cs.HC': { star3: 30, star2: 10 },
    };

    const papers = await this.papersRepository.find({
      relations: { researchFields: true },
      select: {
        arxivId: true,
        influenceScore: true,
        researchFields: { name: true },
      },
    });

    for (const paper of papers) {
      if (paper.influenceScore === null || paper.researchFields.length === 0)
        continue;

      let starTier = 1;

      for (const field of paper.researchFields) {
        const threshold = fieldThresholds[field.name];
        if (!threshold) continue;

        if (paper.influenceScore >= threshold.star3) {
          starTier = Math.max(starTier, 3);
        } else if (paper.influenceScore >= threshold.star2) {
          starTier = Math.max(starTier, 2);
        }
      }

      await this.papersRepository.update(
        { arxivId: paper.arxivId },
        { starTier },
      );
    }

    return { updated: papers.length };
  }

  // arxiv 논문 기준 유사 논문 추천(기본 논문 + 휴먼과 논문 통합)
  async getSimilarPapers(arxivId: string, limit: number = 5) {
    const paper = await this.papersRepository.findOne({
      where: { arxivId },
      select: { arxivId: true, embedding: true },
    });

    if (!paper || !paper.embedding) {
      throw new NotFoundException('해당 논문의 임베딩이 존재하지 않습니다.');
    }

    return this.findSimilarByEmbedding(paper.embedding, { arxivId }, limit);
  }

  // 주어진 임베딩 벡터로 기본 논문(paper) + 휴먼과 논문(hai_paper)을 통합 검색하여
  // 유사도 내림차순으로 섞인 단일 목록을 반환한다.
  // - exclude.arxivId / exclude.haiId: 기준이 된 논문 자신을 결과에서 제외
  async findSimilarByEmbedding(
    embedding: string,
    exclude: { arxivId?: string; haiId?: number },
    limit: number = 5,
  ) {
    const excludeArxivId = exclude.arxivId ?? null;
    const excludeHaiId = exclude.haiId ?? null;

    return this.papersRepository.query(
      `SELECT * FROM (
            SELECT 'arxiv' AS type, p."arxivId" AS id, p.title, p.pdf_url AS "pdfUrl",
                   1 - (p.embedding::vector <=> $1::vector) AS similarity
            FROM paper p
            WHERE p.embedding IS NOT NULL
              AND ($2::text IS NULL OR p."arxivId" != $2)
            UNION ALL
            SELECT 'hai' AS type, h.id::text AS id, h.title, h.pdf_url AS "pdfUrl",
                   1 - (h.embedding::vector <=> $1::vector) AS similarity
            FROM hai_paper h
            WHERE h.embedding IS NOT NULL
              AND ($3::int IS NULL OR h.id != $3)
        ) AS combined
        ORDER BY similarity DESC
        LIMIT $4`,
      [embedding, excludeArxivId, excludeHaiId, limit],
    );
  }

  // 논문 삭제 (arxivId 목록 또는 날짜 범위)
  async deletePapers(arxivIds?: string, startDate?: string, endDate?: string) {
    if (!arxivIds && !startDate && !endDate) {
      throw new BadRequestException(
        'arxivIds 또는 날짜 범위(startDate/endDate)를 입력해주세요',
      );
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
      const qb = this.papersRepository
        .createQueryBuilder('paper')
        .leftJoinAndSelect('paper.authors', 'author');
      if (startDate)
        qb.andWhere('paper.publishedDate >= :startDate', { startDate });
      if (endDate) qb.andWhere('paper.publishedDate <= :endDate', { endDate });
      papersToDelete = await qb.getMany();
    }

    if (papersToDelete.length === 0) return { deleted: 0, authorsDeleted: 0 };

    // ── 2. 삭제 대상 저자 ID 수집 ────────────────────────────────────────────
    const authorIds = [
      ...new Set(papersToDelete.flatMap((p) => p.authors.map((a) => a.id))),
    ];

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
