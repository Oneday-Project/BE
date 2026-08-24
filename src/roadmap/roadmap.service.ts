import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
    RoadmapTask,
    RoadmapStage,
    RoadmapPriority,
} from './entities/roadmap-task.entity';
import {
    RoadmapPaperRecommendation,
    RoadmapRadar,
    RoadmapResult,
    RoadmapSnapshot,
    UserRoadmap,
} from './entities/user-roadmap.entity';
import {
    AnalyzeRoadmapDto,
    Q9_NONE,
    Q10_NONE,
} from './dto/analyze-roadmap.dto';
import { AiServicesService } from 'src/ai-services/ai-services.service';
import { MajorCourse } from 'src/major-courses/entities/major-course.entity';
import { PapersService } from 'src/papers/papers.service';

// 기초 전공과목 태그. 관심 분야와 무관하게 항상 추천(강조) 처리한다.
const MAJOR_BASIC_TAG = '기초';

// Q7(한 달 평균 논문 읽는 편수) 점수 -> 성장 가이드에 표시할 빈도 라벨
const PAPER_FREQUENCY_LABELS: Record<number, string> = {
    0: '월 0회',
    2.5: '월 1~3회',
    5: '월 4~6회',
    7.5: '월 7~9회',
    10: '월 10회 이상',
};

// 추천 과제 정렬 우선순위 (숫자가 작을수록 먼저 표시).
// priority 컬럼은 varchar라 그대로 정렬하면 알파벳순(high, low, medium)이 되어버리므로
// 조회 후 이 맵 기준으로 재정렬한다.
const TASK_PRIORITY_ORDER: Record<RoadmapPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
};

// 논문 로드맵에서 태그당 확보해 둘 후보 논문 수.
// 앞 태그와 겹치거나 이미 읽은 논문을 건너뛰고도 카드를 채울 수 있도록 넉넉히 받아둔다.
const PAPER_CANDIDATE_POOL_SIZE = 20;

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
        private readonly papersService: PapersService,
    ) {}

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
        return q3to8 + q9Score + q10Score + dto.q11 + dto.gpaBand;
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
            academic: this.round((dto.q11 + dto.gpaBand) / 2),
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
        if (dto.gpaBand <= 2.5) weaknesses.push('학점 개선 필요');
        return weaknesses;
    }

    // 성장 가이드 '현재 논문 빈도' 라벨 (Q7 답변 그대로 사용)
    private paperFrequencyLabel(dto: AnalyzeRoadmapDto): string {
        return PAPER_FREQUENCY_LABELS[dto.q7] ?? '월 0회';
    }

    // 성장 가이드 '현재 대외 경험' 라벨 (Q9+Q10 선택 개수, '없음' 제외, 최대 8개)
    private externalActivityLabel(dto: AnalyzeRoadmapDto): string {
        const count =
            dto.q9.filter((item) => item !== Q9_NONE).length +
            dto.q10.filter((item) => item !== Q10_NONE).length;
        if (count === 0) return '0회';
        if (count <= 2) return '1~2회';
        if (count <= 5) return '3~5회';
        return '6~8회';
    }

    // 관심 분야(태그)별 핵심 논문 추천 (선택한 관심 분야 개수만큼, 최대 3개)
    // papers 모듈의 조회를 그대로 재사용한다: 영향력 지표(influenceScore) 내림차순 후보를 받아
    // 아래 우선순위로 태그마다 1편씩 배정한다.
    // 순위만 getAllPapers로 뽑고, 카드 표시용 상세 정보(AI 카드 요약 포함)는
    // getPaperByArxivId로 다시 조회한다(이 조회에만 aiSummary가 join되어 있음).
    private async getPaperRoadmap(
        interestFields: string[],
        userId: number,
    ): Promise<RoadmapPaperRecommendation[]> {
        // 읽음 여부 필터를 쿼리에 걸지 않고(includeCompleted: true) 후보를 통째로 받아온다.
        // 쿼리에서 걸러버리면 '이미 다 읽은 분야'의 카드가 비어버리기 때문에,
        // 읽음 여부는 아래에서 우선순위로만 반영한다. 응답의 readingStatus로 판별한다.
        const candidatesByTag = await Promise.all(
            interestFields.map(async (tag) => {
                const { data } = await this.papersService.getAllPapers(
                    {
                        tags: [tag],
                        order: ['influenceScore_DESC'],
                        take: PAPER_CANDIDATE_POOL_SIZE,
                        includeCompleted: true,
                    },
                    userId,
                );
                return data;
            }),
        );

        // 관심 분야를 선택한 순서대로 우선권을 준다. 각 태그는 아래 순서로 후보를 고른다.
        //   1) 아직 안 읽었고 + 앞 태그가 안 가져간 논문      (가장 이상적)
        //   2) 앞 태그가 안 가져간 논문 (이미 읽은 논문이라도)  - 중복 노출보다 낫다고 판단
        //   3) 그 분야 1위 (앞 태그와 겹치더라도)             - 카드를 비우지 않기 위한 최후 수단
        // 예: tag1과 tag2의 1위가 같으면 tag1이 그 논문을, tag2는 자기 2위를 가져간다.
        // 그 분야에 논문이 DB에 아예 없을 때만 null이 된다.
        const usedArxivIds = new Set<string>();
        const picks = interestFields.map((tag, index) => {
            const candidates = candidatesByTag[index];
            const isUnused = (paper: { arxivId: string }) =>
                !usedArxivIds.has(paper.arxivId);

            const pick =
                candidates.find(
                    (paper) =>
                        isUnused(paper) &&
                        (!('readingStatus' in paper) ||
                            paper.readingStatus !== 'completed'),
                ) ??
                candidates.find(isUnused) ??
                candidates[0];

            if (pick) {
                usedArxivIds.add(pick.arxivId);
            }
            return { tag, arxivId: pick?.arxivId };
        });

        return Promise.all(
            picks.map(async ({ tag, arxivId }) => {
                if (!arxivId) {
                    return { tag, paper: null };
                }

                const paper = await this.papersService.getPaperByArxivId(
                    arxivId,
                    userId,
                );
                return { tag, paper };
            }),
        );
    }

    // 설문 응답을 분석해 로드맵 결과(점수/단계/레이더/추천 과제)를 만든다.
    // GPT를 호출하므로 반드시 로그인한 사용자만 도달할 수 있어야 한다(userId 필수).
    // 논문 로드맵은 그 사용자의 읽음 기록 기준으로 개인화한다.
    private async buildResult(
        dto: AnalyzeRoadmapDto,
        userId: number,
    ): Promise<RoadmapResult> {
        const totalScore = this.calculateScore(dto);
        const stage = this.determineStage(totalScore);
        const radar = this.calculateRadar(dto);
        const strengths = this.determineStrengths(dto);
        const weaknesses = this.determineWeaknesses(dto);

        const tasks = await this.roadmapTaskRepository.find({
            where: { stage },
        });
        tasks.sort(
            (a, b) =>
                TASK_PRIORITY_ORDER[a.priority] -
                TASK_PRIORITY_ORDER[b.priority],
        );

        const roadmap = {
            major: tasks.filter((t) => t.category === 'major'),
            paper: tasks.filter((t) => t.category === 'paper'),
            growth: tasks.filter((t) => t.category === 'growth'),
        };

        const paperFrequency = this.paperFrequencyLabel(dto);
        const externalActivity = this.externalActivityLabel(dto);

        // 서로 의존성 없는 GPT 호출 2건 + 논문 매칭 조회를 병렬로 실행해 응답 시간을 줄인다.
        const [comment, tips, paperRoadmap] = await Promise.all([
            this.aiServicesService.generateRoadmapComment({
                totalScore,
                stage,
                interestFields: dto.interestFields,
                strengths,
                weaknesses,
                radar,
            }),
            this.aiServicesService.generateRoadmapGrowthGuideTips({
                stage,
                interestFields: dto.interestFields,
                paperFrequencyLabel: paperFrequency,
                externalActivityLabel: externalActivity,
                strengths,
                weaknesses,
                radar,
            }),
            this.getPaperRoadmap(dto.interestFields, userId),
        ]);

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
            paperRoadmap,
            growthGuide: {
                paperFrequency,
                externalActivity,
                tips,
            },
        };
    }

    private async buildSnapshot(
        dto: AnalyzeRoadmapDto,
        userId: number,
    ): Promise<RoadmapSnapshot> {
        const result = await this.buildResult(dto, userId);
        return { answers: dto, result, createdAt: new Date().toISOString() };
    }

    private toResponse(userRoadmap: UserRoadmap) {
        return {
            hasRoadmap: true,
            initial: userRoadmap.initial,
            latest: userRoadmap.latest,
        };
    }

    // 저장 없이 분석 결과만 반환. GPT를 호출하므로 로그인 필수(userId 필수).
    async analyzeRoadmap(
        dto: AnalyzeRoadmapDto,
        userId: number,
    ): Promise<RoadmapResult> {
        return this.buildResult(dto, userId);
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

        const snapshot = await this.buildSnapshot(dto, userId);
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

        userRoadmap.latest = await this.buildSnapshot(dto, userId);
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
            // '기초' 과목은 항상 강조. 그 외에는 관심 분야와 겹치면 강조.
            const courseFields = course.fields ?? [];
            const recommended =
                courseFields.includes(MAJOR_BASIC_TAG) ||
                courseFields.some((c) => interestSet.has(c));
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
            fields: course.fields,
            level: course.level,
            recommended, // 관심 분야와 겹치면 강조(파란 박스)
        };
    }
}
