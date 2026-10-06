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
    INTEREST_FIELD_LABELS,
    Q9_NONE,
    Q9_OPTIONS,
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

// 과목 출처 구분. 전공 로드맵 격자는 'major'만, 하단 바이오헬스 섹션은 'biohealth'만 쓴다.
const COURSE_SOURCE_MAJOR = 'major';
const COURSE_SOURCE_BIOHEALTH = 'biohealth';

// 바이오헬스 추천 교과목을 수준 순(초급 -> 중급 -> 고급)으로 보여주기 위한 정렬 가중치.
const BIOHEALTH_LEVEL_ORDER: Record<string, number> = {
    '초급': 0,
    '중급': 1,
    '고급': 2,
};

// 레이더 점수(0~10)를 GPT에 넘길 말로 바꾸는 구간.
// 숫자를 넘기면 GPT가 "경험 1.3점"처럼 사용자에게 그대로 노출한다.
const LEVEL_WORDS: { min: number; word: string }[] = [
    { min: 7.5, word: '매우 높음' },
    { min: 6, word: '높음' },
    { min: 4, word: '보통' },
    { min: 2, word: '낮음' },
    { min: 0, word: '매우 낮음' },
];

// 레이더 축의 화면 라벨. GPT 코멘트도 이 이름을 그대로 쓴다.
const RADAR_AREA_LABELS: { key: keyof RoadmapRadar; label: string }[] = [
    { key: 'interest', label: '관심 분야 이해' },
    { key: 'experience', label: '연구·프로젝트 경험' },
    { key: 'paper', label: '논문 루틴' },
    { key: 'preparation', label: '포트폴리오' },
    { key: 'academic', label: '학업 성적' },
];

// GPT 프롬프트에 넣을 추천 과목명 최대 개수.
// GPT는 이 중 하나만 골라 언급하므로 후보는 넉넉해도 된다.
const GPT_COURSE_HINT_LIMIT = 8;

// 수강 학년 제한이 없어지는 학년. 4학년은 전 학년 과목을 들을 수 있다.
const SENIOR_YEAR = 4;

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
    // previousRadar는 수정일 때만 넘어온다. GPT가 지난번 대비 변화를 언급할 수 있게 한다.
    private async buildResult(
        dto: AnalyzeRoadmapDto,
        userId: number,
        previousRadar?: RoadmapRadar,
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

        // GPT 프롬프트에 실제 과목명과 논문 제목을 넣기 위해 DB 조회를 먼저 끝낸다.
        // 두 조회는 서로 독립이라 병렬로 돌리고, GPT 2건은 그 뒤에 다시 병렬로 돌린다.
        const [courseHint, paperRoadmap] = await Promise.all([
            this.getRecommendedCourseNames(dto),
            this.getPaperRoadmap(dto.interestFields, userId),
        ]);

        // Q9 보기 중 고르지 않은 항목. GPT가 "다음에 뭘 준비할지"를 추측하지 않고 그대로 쓸 수 있다.
        const preparedItems = dto.q9.filter((item) => item !== Q9_NONE);
        const missingItems = Q9_OPTIONS.filter(
            (option) => option !== Q9_NONE && !preparedItems.includes(option),
        );
        const presentationItems = dto.q10.filter((item) => item !== Q10_NONE);

        const aiContext = {
            stage,
            year: dto.year,
            semester: dto.semester,
            interestFields: dto.interestFields,
            interestFieldLabels: dto.interestFields.map(
                (f) => INTEREST_FIELD_LABELS[f] ?? f,
            ),
            strengths,
            weaknesses,
            radar,
            levelSummary: this.describeLevels(radar),
            lowestArea: this.lowestRadarArea(radar),
            paperReadingState: this.describePaperReading(dto, paperFrequency),
            externalActivityLabel: externalActivity,
            preparedItems,
            missingItems,
            presentationItems,
            recommendedCourses: courseHint.names,
            recommendedCourseNote: courseHint.note,
            recommendedPaperTitle: paperRoadmap.find((p) => p.paper)?.paper
                ?.title,
            previousRadar,
        };

        // 서로 의존성 없는 GPT 호출 2건을 병렬로 실행해 응답 시간을 줄인다.
        const [comment, tips] = await Promise.all([
            this.aiServicesService.generateRoadmapComment({
                ...aiContext,
                totalScore,
            }),
            this.aiServicesService.generateRoadmapGrowthGuideTips(aiContext),
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

    // 레이더 점수를 말로 바꾼다. GPT에는 숫자를 넘기지 않는다.
    private levelWord(value: number): string {
        return (
            LEVEL_WORDS.find((l) => value >= l.min)?.word ?? '매우 낮음'
        );
    }

    private describeLevels(radar: RoadmapRadar): string {
        return RADAR_AREA_LABELS.map(
            ({ key, label }) => `${label} ${this.levelWord(radar[key])}`,
        ).join(' / ');
    }

    // 가장 낮은 축을 코드에서 정해 넘긴다. GPT가 고르게 두면 엉뚱한 축을 짚는다.
    // 동점이면 RADAR_AREA_LABELS 순서가 앞선 축을 쓴다.
    private lowestRadarArea(radar: RoadmapRadar): string {
        return RADAR_AREA_LABELS.reduce((a, b) =>
            radar[b.key] < radar[a.key] ? b : a,
        ).label;
    }

    // 논문 루틴 축은 Q7(읽는 양)과 Q8(이해도)의 평균이라 둘의 비대칭이 묻힌다.
    // 처방이 정반대이므로 어느 쪽이 부족한지를 문장으로 만들어 넘긴다.
    private describePaperReading(
        dto: AnalyzeRoadmapDto,
        frequencyLabel: string,
    ): string {
        const volumeHigh = dto.q7 >= 7.5;
        const volumeLow = dto.q7 <= 5;
        const graspHigh = dto.q8 >= 7.5;
        const graspLow = dto.q8 <= 5;

        if (volumeHigh && graspLow) {
            return `${frequencyLabel} 읽지만 읽을 때 이해 수준은 낮다 (읽는 양은 충분하고 깊이가 부족한 상태)`;
        }
        if (volumeLow && graspHigh) {
            return `${frequencyLabel}로 읽는 양은 적지만 읽을 때 이해 수준은 높다 (깊이는 있고 양이 부족한 상태)`;
        }
        if (volumeLow && graspLow) {
            return `${frequencyLabel}로 읽는 양도 적고 이해 수준도 낮다`;
        }
        if (volumeHigh && graspHigh) {
            return `${frequencyLabel} 읽고 이해 수준도 높다`;
        }
        return `${frequencyLabel}, 이해 수준은 ${this.levelWord(dto.q8)}`;
    }

    // GPT 코멘트에서 실제 과목명을 지목할 수 있도록 관심 분야와 겹치는 전공과목을 모은다.
    // year_recommended/semester는 그 과목의 개설 학기와 대상 학년을 뜻한다.
    // 다음 학기에 열리는 과목이 있으면 그것을 우선 제안하고,
    // 4학년처럼 수강 제한이 없거나 다음 학기 개설 과목이 없으면 관심 분야 과목 전체를 넘긴다.
    private async getRecommendedCourseNames(
        dto: AnalyzeRoadmapDto,
    ): Promise<{ names: string[]; note: string }> {
        const nextYear = dto.semester === 2 ? dto.year + 1 : dto.year;
        const nextSemester = dto.semester === 2 ? 1 : 2;

        const courses = await this.majorCourseRepository.find({
            where: { source: COURSE_SOURCE_MAJOR },
            order: {
                year_recommended: 'ASC',
                semester: 'ASC',
                course_id: 'ASC',
            },
        });

        const interestSet = new Set(dto.interestFields);
        const matched = courses.filter((c) =>
            (c.fields ?? []).some((f) => interestSet.has(f)),
        );

        // 4학년은 전 학년 과목을 수강할 수 있으므로 학기를 좁히지 않는다.
        if (dto.year < SENIOR_YEAR) {
            const nextSemesterCourses = matched.filter(
                (c) =>
                    c.year_recommended === nextYear &&
                    c.semester === nextSemester,
            );
            if (nextSemesterCourses.length > 0) {
                return {
                    names: nextSemesterCourses
                        .map((c) => c.name)
                        .slice(0, GPT_COURSE_HINT_LIMIT),
                    note: `${nextYear}학년 ${nextSemester}학기 개설`,
                };
            }
        }

        return {
            names: matched.map((c) => c.name).slice(0, GPT_COURSE_HINT_LIMIT),
            note:
                dto.year >= SENIOR_YEAR
                    ? '4학년은 전 학년 과목을 수강할 수 있어 관심 분야 과목 전체'
                    : '다음 학기 개설 과목이 없어 관심 분야 과목 전체',
        };
    }

    private async buildSnapshot(
        dto: AnalyzeRoadmapDto,
        userId: number,
        previousRadar?: RoadmapRadar,
    ): Promise<RoadmapSnapshot> {
        const result = await this.buildResult(dto, userId, previousRadar);
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

        // 수정 전 최근 로드맵의 레이더를 넘겨 GPT가 변화를 언급할 수 있게 한다.
        userRoadmap.latest = await this.buildSnapshot(
            dto,
            userId,
            userRoadmap.latest.result.radar,
        );
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
    // 하단 '바이오헬스 추천 교과목' 섹션은 별도 배열(biohealthCourses)로 함께 반환한다.
    async getMajorRoadmap(userId: number) {
        const userRoadmap = await this.userRoadmapRepository.findOne({
            where: { userId },
        });
        const interestFields =
            userRoadmap?.latest.answers.interestFields ?? [];
        const interestSet = new Set(interestFields);

        // 전공과목만. 바이오헬스는 year_recommended/semester가 null이라
        // 학년/학기 격자에 섞이면 안 된다.
        const courses = await this.majorCourseRepository.find({
            where: { source: COURSE_SOURCE_MAJOR },
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

            // source='major'면 DB 제약상 둘 다 not null이지만, 엔티티 타입은 optional이므로 방어한다.
            const year = course.year_recommended;
            const semester = course.semester;
            if (year === null || year === undefined) continue;
            if (semester === null || semester === undefined) continue;

            if (!yearMap.has(year)) {
                yearMap.set(year, new Map());
            }
            const semesterMap = yearMap.get(year)!;
            if (!semesterMap.has(semester)) {
                semesterMap.set(semester, []);
            }
            semesterMap.get(semester)!.push(item);
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

        const biohealthCourses =
            await this.getBiohealthCourses(interestFields);

        return { interestFields, years, biohealthCourses };
    }

    // 결과 페이지 하단 '바이오헬스 추천 교과목' 섹션용 조회.
    // 관심 분야로 태그가 겹치는 바이오헬스 과목만 가져온다.
    // 한 과목이 여러 관심 분야에 걸리면 앞선 관심 분야(tag1 > tag2 > tag3)의 배지를 달고 한 번만 노출한다.
    private async getBiohealthCourses(interestFields: string[]) {
        if (interestFields.length === 0) return [];

        const courses = await this.majorCourseRepository.find({
            where: { source: COURSE_SOURCE_BIOHEALTH },
            order: { course_id: 'ASC' },
        });

        const items = courses
            .map((course) => {
                const courseFields = course.fields ?? [];
                // 사용자가 고른 순서대로 훑어 첫 번째로 걸리는 태그를 배지로 쓴다.
                const tag = interestFields.find((f) => courseFields.includes(f));
                if (!tag) return null;
                return {
                    tag, // 왼쪽 배지 (예: 'CV')
                    courseId: course.course_id,
                    name: course.name,
                    description: course.description,
                    category: course.category, // 전공 칩 (예: '인공지능')
                    level: course.level, // 수준 칩 (초급/중급/고급)
                    credit: course.credit, // 학점 칩
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        // 관심 분야 순 -> 수준 순(초급 먼저) -> 과목코드 순
        return items.sort(
            (a, b) =>
                interestFields.indexOf(a.tag) - interestFields.indexOf(b.tag) ||
                (BIOHEALTH_LEVEL_ORDER[a.level] ?? 99) -
                    (BIOHEALTH_LEVEL_ORDER[b.level] ?? 99) ||
                a.courseId.localeCompare(b.courseId),
        );
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
