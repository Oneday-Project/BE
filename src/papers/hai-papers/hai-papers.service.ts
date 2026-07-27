import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryRunner, Repository } from 'typeorm';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';
import { GetHaiPapersPaginationDto } from './dto/get-hai-papers-pagination.dto';
import { HaiPaper } from '../entities/hai-papers.entity';
import { HaiPaperBookmark } from '../entities/hai-paper-bookmarks.entity';
import { HaiPaperReadingStatus } from '../entities/hai-paper-reading-status.entity';
import { HaiPaperActivityLog } from '../entities/hai-paper-activity-log.entity';
import { ReadingStatusEnum } from '../entities/paper-reading-status.entity';
import { PapersService } from '../papers.service';
import { UsersService } from 'src/users/users.service';
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
    private readonly usersService: UsersService,
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

    const readingStatus = await this.resolveReadingStatus(id, userId);

    return { ...haiPaper, readingStatus };
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

    const haiPaper = await haipapersRepository.findOne({
      where: { id },
    });

    if (!haiPaper) {
      throw new NotFoundException('존재하지 않는 휴먼과 논문입니다!');
    }

    const user = await this.usersService.findUserById(userId);

    const bookmarkRecord = await haiPaperBookmarkRepository.findOne({
      where: { haiPaper: { id }, user: { id: userId } },
    });

    if (bookmarkRecord) {
      await haiPaperBookmarkRepository.delete({
        haiPaper: { id },
        user: { id: userId },
      });

      await haipapersRepository.decrement({ id }, 'bookmarkCount', 1);

      return { isBookmark: false };
    } else {
      await haiPaperBookmarkRepository.save({
        haiPaper,
        user,
      });

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

    const haiPaper = await haipapersRepository.findOne({ where: { id } });
    if (!haiPaper) {
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
