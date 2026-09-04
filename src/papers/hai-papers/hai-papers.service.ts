import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, QueryRunner, Repository } from 'typeorm';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';
import { GetHaiPapersPaginationDto } from './dto/get-hai-papers-pagination.dto';
import { HaiPaper } from '../entities/hai-papers.entity';
import { HaiPaperBookmark } from '../entities/hai-paper-bookmarks.entity';
import { HaiPaperReadingStatus } from '../entities/hai-paper-reading-status.entity';
import { HaiPaperActivityLog } from '../entities/hai-paper-activity-log.entity';
import { ReadingStatusEnum } from '../entities/paper-reading-status.entity';
import { PapersService } from '../papers.service';
import { CommonService } from 'src/common/common.service';

@Injectable()
export class HaiPapersService {
  private readonly READING_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    @InjectRepository(HaiPaper)
    private readonly haipapersRepository: Repository<HaiPaper>,
    @InjectRepository(HaiPaperBookmark)
    private readonly haiPaperBookmarkRepository: Repository<HaiPaperBookmark>,
    @InjectRepository(HaiPaperReadingStatus)
    private readonly haiPaperReadingStatusRepository: Repository<HaiPaperReadingStatus>,
    @InjectRepository(HaiPaperActivityLog)
    private readonly haiPaperActivityLogRepository: Repository<HaiPaperActivityLog>,
    private readonly papersService: PapersService,
    private readonly commonService: CommonService,
  ) {}

  async createHaiPaper(dto: CreateHAIpaperDto) {
    const haiPaperExists = await this.haipapersRepository.exists({
      where: {
        doi: dto.doi,
        title: dto.title,
      },
    });

    if (haiPaperExists) {
      throw new ConflictException('이미 존재하는 휴먼과 논문입니다!');
    }

    const haiPaper = this.haipapersRepository.create(dto);
    return this.haipapersRepository.save(haiPaper);
  }

  // 조건에 해당되는 모든 휴먼과 논문 가져오기(페이지네이션/검색 적용, PapersService.getAllPapers와 동일한 방식)
  // researchFields/authors가 관계가 아니라 simple-json 컬럼이라 조인 없이 바로 필터링한다.
  async getAllHaiPapers(dto: GetHaiPapersPaginationDto, userId?: number) {
    const { keyword, tags, department, yearRange } = dto;

    const qb = this.haipapersRepository.createQueryBuilder('haiPaper');

    // 분야(태그)로 검색하는 기능 - researchFields는 simple-json 배열 컬럼이라 jsonb로 캐스팅해서 원소 매칭
    if (tags && tags.length > 0) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE("haiPaper"."researchFields", '[]')::jsonb) AS tag WHERE tag IN (:...tags))`,
        { tags },
      );
    }

    // 연구실(department)로 검색하는 기능 - 다중 선택 가능
    if (department && department.length > 0) {
      qb.andWhere('haiPaper.department IN (:...department)', { department });
    }

    // 검색창 기능(제목/초록/저자에서 찾아서 검색)
    if (keyword) {
      qb.andWhere(
        `(haiPaper.title ILIKE :keyword OR haiPaper.abstract ILIKE :keyword OR haiPaper.authors ILIKE :keyword)`,
        { keyword: `%${keyword}%` },
      );
    }

    // 최근 몇년으로 검색하는 기능 (publishedYear가 연도 문자열이라 문자열 비교로 처리)
    if (yearRange) {
      const startYear = String(new Date().getFullYear() - yearRange);
      qb.andWhere('haiPaper.publishedYear >= :startYear', { startYear });
    }

    const result = await this.commonService.cursorPagination(qb, dto);

    if (userId === undefined || result.data.length === 0) {
      return result;
    }

    const haiIds = result.data.map((p) => p.id);

    const [bookmarks, statuses] = await Promise.all([
      this.haiPaperBookmarkRepository.find({
        where: { userId, haiPaperId: In(haiIds) },
      }),
      this.haiPaperReadingStatusRepository.find({
        where: { userId, haiPaperId: In(haiIds) },
      }),
    ]);

    const bookmarkedSet = new Set(bookmarks.map((b) => b.haiPaperId));
    const statusMap = new Map(statuses.map((s) => [s.haiPaperId, s]));

    const data = result.data.map((haiPaper) => {
      const status = statusMap.get(haiPaper.id);
      const readingStatus =
        !status || (status.status === ReadingStatusEnum.READING && this.isExpiredReading(status))
          ? 'unread'
          : status.status;

      return {
        ...haiPaper,
        isBookmark: bookmarkedSet.has(haiPaper.id),
        readingStatus,
      };
    });

    return { ...result, data };
  }

  // id 기반 단일 휴먼과 논문 GET
  // userId가 주어지면(로그인한 유저의 API 호출) 해당 유저 기준 읽기 상태를 함께 반환한다.
  async getHaiPaperById(id: number, userId?: number) {
    const haiPaper = await this.haipapersRepository.findOne({
      where: {
        id,
      },
    });

    if (!haiPaper) {
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    if (userId === undefined) {
      return haiPaper;
    }

    const [readingStatus, bookmark] = await Promise.all([
      this.resolveReadingStatus(id, userId),
      this.haiPaperBookmarkRepository.findOne({
        where: { haiPaperId: id, userId },
      }),
    ]);

    return { ...haiPaper, isBookmark: !!bookmark, readingStatus };
  }

  async updateHaiPaper(id: number, dto: UpdatHAIpaperDto) {
    const haiPaper = await this.haipapersRepository.exists({
      where: {
        id,
      },
    });

    if (!haiPaper) {
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    await this.haipapersRepository.update(id, dto);
    return this.haipapersRepository.findOne({
      where: {
        id,
      },
    });
  }

  async deleteHaiPaper(id: number) {
    const haiPaper = await this.haipapersRepository.exists({
      where: {
        id,
      },
    });

    if (!haiPaper) {
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

    return this.papersService.findSimilarByEmbedding(
      haiPaper.embedding,
      { haiId: id },
      limit,
    );
  }

  // 북마크 기능 (PapersService.togglePaperBookmark와 동일한 구조, HaiPaper 전용)
  async toggleHaiPaperBookmark(id: number, userId: number, qr: QueryRunner) {
    const haipapersRepository = qr.manager.getRepository<HaiPaper>(HaiPaper);
    const haiPaperBookmarkRepository =
      qr.manager.getRepository<HaiPaperBookmark>(HaiPaperBookmark);

    // 존재 여부만 확인하면 되므로 exists 사용(findOne이면 abstract까지 통째로 읽어온다)
    const haiPaperExists = await haipapersRepository.exists({
      where: { id },
    });

    if (!haiPaperExists) {
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    const bookmarkRecord = await haiPaperBookmarkRepository.findOne({
      where: { haiPaper: { id }, user: { id: userId } },
    });

    if (bookmarkRecord) {
      const deleteResult = await haiPaperBookmarkRepository.delete({
        haiPaper: { id },
        user: { id: userId },
      });

      // 동시에 들어온 중복 요청(더블클릭 등)이 이미 지웠다면 delete는 에러 없이 0건으로 끝난다.
      // 그때도 decrement를 돌려버리면 카운트만 더 줄어들어 실제 북마크 수와 어긋나므로
      // 실제로 지워졌을 때만 카운트를 내린다.
      if (deleteResult.affected) {
        await haipapersRepository.decrement({ id }, 'bookmarkCount', 1);
      }

      return { isBookmark: false };
    } else {
      try {
        // 관계 객체 대신 PK 컬럼만 넣어 저장한다(엔티티에 haiPaperId/userId가 그대로 있음).
        // 유저를 다시 조회할 필요가 없어져 북마크 토글에서 쿼리 하나가 통째로 빠진다.
        // (유저 존재 여부는 AccessTokenGuard가 이미 확인했고, FK 제약이 최후 방어선이다)
        await haiPaperBookmarkRepository.save({
          haiPaperId: id,
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

      await haipapersRepository.increment({ id }, 'bookmarkCount', 1);

      return { isBookmark: true };
    }
  }

  // 읽는 중 상태 토글(시작/취소) (PapersService.toggleReadingStatus와 동일한 구조, HaiPaper 전용)
  async toggleReadingStatus(id: number, userId: number, qr: QueryRunner) {
    const haipapersRepository = qr.manager.getRepository<HaiPaper>(HaiPaper);
    const haiPaperReadingStatusRepository =
      qr.manager.getRepository<HaiPaperReadingStatus>(HaiPaperReadingStatus);
    const haiPaperActivityLogRepository =
      qr.manager.getRepository<HaiPaperActivityLog>(HaiPaperActivityLog);

    // 존재 여부만 확인하면 되므로 exists 사용(findOne이면 abstract까지 통째로 읽어온다)
    const haiPaperExists = await haipapersRepository.exists({ where: { id } });
    if (!haiPaperExists) {
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    let existing = await haiPaperReadingStatusRepository.findOne({
      where: { haiPaperId: id, userId },
    });

    // 30일 지난 '읽는 중' 상태는 이미 안읽음으로 취급 -> row를 지우고 없던 것처럼 처리
    if (
      existing &&
      existing.status === ReadingStatusEnum.READING &&
      this.isExpiredReading(existing)
    ) {
      await haiPaperReadingStatusRepository.delete({ haiPaperId: id, userId });
      existing = null;
    }

    if (existing) {
      if (existing.status === ReadingStatusEnum.COMPLETED) {
        throw new ConflictException('이미 읽기 완료된 논문입니다.');
      }

      // 읽는 중 -> 안읽음(취소)
      await haiPaperReadingStatusRepository.delete({ haiPaperId: id, userId });

      // 오늘 접속으로 자동 기록됐을 활동 로그만 롤백(과거 날짜 로그는 보존)
      await haiPaperActivityLogRepository.delete({
        haiPaperId: id,
        userId,
        date: this.today(),
      });

      return { status: 'unread' };
    }

    // 안읽음 -> 읽는 중
    try {
      await haiPaperReadingStatusRepository.save({
        haiPaperId: id,
        userId,
        status: ReadingStatusEnum.READING,
        startedAt: new Date(),
        completedAt: null,
      });

      await haiPaperActivityLogRepository.save({
        haiPaperId: id,
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

  // 읽기 완료로 전환 (PapersService.completeReading과 동일한 구조, HaiPaper 전용)
  async completeReading(id: number, userId: number, qr: QueryRunner) {
    const haiPaperReadingStatusRepository =
      qr.manager.getRepository<HaiPaperReadingStatus>(HaiPaperReadingStatus);
    const haiPaperActivityLogRepository =
      qr.manager.getRepository<HaiPaperActivityLog>(HaiPaperActivityLog);

    const existing = await haiPaperReadingStatusRepository.findOne({
      where: { haiPaperId: id, userId },
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
      await haiPaperReadingStatusRepository.delete({ haiPaperId: id, userId });
      throw new NotFoundException(
        '읽는 중인 논문이 아닙니다. 먼저 읽는 중으로 표시해주세요.',
      );
    }

    existing.status = ReadingStatusEnum.COMPLETED;
    existing.completedAt = new Date();
    await haiPaperReadingStatusRepository.save(existing);

    await haiPaperActivityLogRepository.save({
      haiPaperId: id,
      userId,
      date: this.today(),
    });

    return { status: 'completed' };
  }

  // 읽기 상태 조회 + 30일 지연 만료 처리 + 활동 로그 기록
  private async resolveReadingStatus(
    id: number,
    userId: number,
  ): Promise<'unread' | 'reading' | 'completed'> {
    const status = await this.haiPaperReadingStatusRepository.findOne({
      where: { haiPaperId: id, userId },
    });

    if (!status) return 'unread';

    if (status.status === ReadingStatusEnum.READING) {
      if (this.isExpiredReading(status)) {
        await this.haiPaperReadingStatusRepository.delete({
          haiPaperId: id,
          userId,
        });
        return 'unread';
      }

      await this.logReadingActivity(id, userId);
    }

    return status.status;
  }

  // '읽는 중' 상태가 30일 만료 기준을 넘겼는지 확인
  private isExpiredReading(status: HaiPaperReadingStatus): boolean {
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

  // 오늘 날짜 활동 로그 upsert(이미 있으면 무시)
  private async logReadingActivity(id: number, userId: number) {
    const date = this.today();

    const exists = await this.haiPaperActivityLogRepository.exists({
      where: { haiPaperId: id, userId, date },
    });

    if (!exists) {
      await this.haiPaperActivityLogRepository.save({
        haiPaperId: id,
        userId,
        date,
      });
    }
  }

  // UTC가 아닌 한국시간(KST, UTC+9) 기준 날짜로 변환
  private toDateStr(date: Date): string {
    const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
    return new Date(date.getTime() + KST_OFFSET_MS).toISOString().split('T')[0];
  }

  private today(): string {
    return this.toDateStr(new Date());
  }
}
