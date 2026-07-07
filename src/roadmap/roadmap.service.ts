import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoadmapTask, RoadmapStage } from './entities/roadmap-task.entity';
import {
    RoadmapRadar,
    RoadmapResult,
    RoadmapSnapshot,
    UserRoadmap,
} from './entities/user-roadmap.entity';
import {
    AnalyzeRoadmapDto,
    Q9_NONE,
    Q10_NONE,
    GPA_BANDS,
} from './dto/analyze-roadmap.dto';
import { AiServicesService } from 'src/ai-services/ai-services.service';
import { MajorCourse } from 'src/major-courses/entities/major-course.entity';

@Injectable()
export class RoadmapService {
    constructor(
        @InjectRepository(RoadmapTask)
        private readonly roadmapTaskRepository: Repository<RoadmapTask>,
        @InjectRepository(UserRoadmap)
        private readonly userRoadmapRepository: Repository<UserRoadmap>,
        @InjectRepository(MajorCourse)
        private readonly majorCourseRepository: Repository<MajorCourse>,
        private readonly aiServicesService: AiServicesService,
    ) {}

    // GPA 구간을 점수로 환산 (구간 인덱스 * 2.5 -> 0 / 2.5 / 5 / 7.5 / 10)
    private gpaScore(gpaBand: string): number {
        return GPA_BANDS.indexOf(gpaBand as (typeof GPA_BANDS)[number]) * 2.5;
    }

    // 복수 선택 문항을 점수로 환산 ('없음' 제외, 항목당 2.5점, 최대 10점)
    private multiSelectScore(items: string[], none: string): number {
        const count = items.filter((item) => item !== none).length;
        return Math.min(count * 2.5, 10);
    }

    private round(value: number): number {
        return Math.round(value * 10) / 10;
    }

    private calculateScore(dto: AnalyzeRoadmapDto): number {
        const q3to8 = dto.q3 + dto.q4 + dto.q5 + dto.q6 + dto.q7 + dto.q8;
        const q9Score = this.multiSelectScore(dto.q9, Q9_NONE);
        const q10Score = this.multiSelectScore(dto.q10, Q10_NONE);
        return q3to8 + q9Score + q10Score + dto.q11 + this.gpaScore(dto.gpaBand);
    }

    // 메인페이지 오각형 그래프용 5개 축 점수 (각 0~10)
    private calculateRadar(dto: AnalyzeRoadmapDto): RoadmapRadar {
        const q9Score = this.multiSelectScore(dto.q9, Q9_NONE);
        const q10Score = this.multiSelectScore(dto.q10, Q10_NONE);
        return {
            interest: this.round((dto.q3 + dto.q4) / 2),
            experience: this.round((dto.q5 + dto.q6) / 2),
            paper: this.round((dto.q7 + dto.q8) / 2),
            preparation: this.round((q9Score + q10Score) / 2),
            academic: this.round((dto.q11 + this.gpaScore(dto.gpaBand)) / 2),
        };
    }

    private determineStage(totalScore: number): RoadmapStage {
        if (totalScore < 40) return 'foundation';
        if (totalScore < 70) return 'exploration';
        return 'specialization';
    }

    private determineStrengths(dto: AnalyzeRoadmapDto): string[] {
        const strengths: string[] = [];
        if (dto.interestFields.length >= 2) strengths.push('관심 분야 명확함');
        if (dto.q5 >= 7.5) strengths.push('프로젝트 경험 보유');
        if (dto.q7 >= 5) strengths.push('연구 활동 경험 있음');
        return strengths;
    }

    private determineWeaknesses(dto: AnalyzeRoadmapDto): string[] {
        const weaknesses: string[] = [];
        if (dto.q5 <= 2.5) weaknesses.push('프로젝트 경험 부족');
        if (dto.q7 <= 2.5) weaknesses.push('연구 경험 부족');
        // 하위 2개 구간('2.5 미만', '2.5 이상 ~ 3.0 미만')이면 학점 개선 필요
        if (this.gpaScore(dto.gpaBand) <= 2.5) weaknesses.push('학점 개선 필요');
        return weaknesses;
    }

    // 설문 응답을 분석해 로드맵 결과(점수/단계/레이더/추천 과제)를 만든다.
    private async buildResult(dto: AnalyzeRoadmapDto): Promise<RoadmapResult> {
        const totalScore = this.calculateScore(dto);
        const stage = this.determineStage(totalScore);
        const radar = this.calculateRadar(dto);
        const strengths = this.determineStrengths(dto);
        const weaknesses = this.determineWeaknesses(dto);

        const tasks = await this.roadmapTaskRepository.find({
            where: { stage },
            order: { priority: 'ASC' },
        });

        const roadmap = {
            major: tasks.filter((t) => t.category === 'major'),
            paper: tasks.filter((t) => t.category === 'paper'),
            growth: tasks.filter((t) => t.category === 'growth'),
        };

        const comment = await this.aiServicesService.generateRoadmapComment({
            totalScore,
            stage,
            interestFields: dto.interestFields,
            strengths,
            weaknesses,
            radar,
        });

        return {
            overview: {
                totalScore,
                stage,
                interestFields: dto.interestFields, // 선택한 관심 분야만
                comment,
            },
            radar,
            strengths,
            weaknesses,
            roadmap,
        };
    }

    private async buildSnapshot(
        dto: AnalyzeRoadmapDto,
    ): Promise<RoadmapSnapshot> {
        const result = await this.buildResult(dto);
        return { answers: dto, result, createdAt: new Date().toISOString() };
    }

    private toResponse(userRoadmap: UserRoadmap) {
        return {
            hasRoadmap: true,
            initial: userRoadmap.initial,
            latest: userRoadmap.latest,
        };
    }

    // 저장 없이 분석 결과만 반환 (생성 전 미리보기용)
    async analyzeRoadmap(dto: AnalyzeRoadmapDto): Promise<RoadmapResult> {
        return this.buildResult(dto);
    }

    // 최초 로드맵 생성. 이미 있으면 409 (수정 API로 안내).
    async createRoadmap(userId: number, dto: AnalyzeRoadmapDto) {
        const existing = await this.userRoadmapRepository.findOne({
            where: { userId },
        });
        if (existing) {
            throw new ConflictException(
                '이미 생성된 로드맵이 있습니다. 최근 로드맵 수정 API를 이용해 주세요.',
            );
        }

        const snapshot = await this.buildSnapshot(dto);
        const saved = await this.userRoadmapRepository.save(
            this.userRoadmapRepository.create({
                userId,
                initial: snapshot, // 최초 로드맵 = 생성 시점 스냅샷
                latest: snapshot, // 최근 로드맵도 동일하게 시작
            }),
        );
        return this.toResponse(saved);
    }

    // 최근 로드맵 수정. 없으면 404 (먼저 생성하도록 안내). 최초 로드맵은 보존.
    async updateRoadmap(userId: number, dto: AnalyzeRoadmapDto) {
        const userRoadmap = await this.userRoadmapRepository.findOne({
            where: { userId },
        });
        if (!userRoadmap) {
            throw new NotFoundException(
                '생성된 로드맵이 없습니다. 먼저 로드맵을 생성해 주세요.',
            );
        }

        userRoadmap.latest = await this.buildSnapshot(dto);
        const saved = await this.userRoadmapRepository.save(userRoadmap);
        return this.toResponse(saved);
    }

    // 메인페이지 오각형 그래프용 조회 (최초 + 최근). 없으면 hasRoadmap=false.
    async getMyRoadmap(userId: number) {
        const userRoadmap = await this.userRoadmapRepository.findOne({
            where: { userId },
        });
        if (!userRoadmap) {
            return { hasRoadmap: false, initial: null, latest: null };
        }
        return this.toResponse(userRoadmap);
    }

    // 결과 페이지 '전공 로드맵' 섹션용 조회.
    // 전공과목 DB를 매번 조회하므로 팀원이 과목을 추가/수정/삭제하면 즉시 반영된다.
    // 학년 -> 학기 순으로 그룹핑하고, 사용자의 최근 관심 분야와 겹치는 과목은 recommended=true.
    async getMajorRoadmap(userId: number) {
        const userRoadmap = await this.userRoadmapRepository.findOne({
            where: { userId },
        });
        const interestFields =
            userRoadmap?.latest.answers.interestFields ?? [];
        const interestSet = new Set(interestFields);

        const courses = await this.majorCourseRepository.find({
            order: {
                year_recommended: 'ASC',
                semester: 'ASC',
                course_id: 'ASC',
            },
        });

        // 학년 -> 학기 구조로 그룹핑
        const yearMap = new Map<
            number,
            Map<number, ReturnType<typeof this.toCourseItem>[]>
        >();

        for (const course of courses) {
            const recommended = (course.fields ?? []).some((c) =>
                interestSet.has(c),
            );
            const item = this.toCourseItem(course, recommended);

            if (!yearMap.has(course.year_recommended)) {
                yearMap.set(course.year_recommended, new Map());
            }
            const semesterMap = yearMap.get(course.year_recommended)!;
            if (!semesterMap.has(course.semester)) {
                semesterMap.set(course.semester, []);
            }
            semesterMap.get(course.semester)!.push(item);
        }

        const years = [...yearMap.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([year, semesterMap]) => ({
                year,
                semesters: [...semesterMap.entries()]
                    .sort((a, b) => a[0] - b[0])
                    .map(([semester, courseItems]) => ({
                        semester,
                        courses: courseItems,
                    })),
            }));

        return { interestFields, years };
    }

    // 전공과목 -> 결과 페이지 표시용 항목 (과목명 + hover 툴팁용 설명 포함)
    private toCourseItem(course: MajorCourse, recommended: boolean) {
        return {
            courseId: course.course_id,
            name: course.name, // 박스에 표시할 과목명
            description: course.description, // 과목명 hover 시 보여줄 설명
            category: course.fields,
            level: course.level,
            recommended, // 관심 분야와 겹치면 강조(파란 박스)
        };
    }
}
