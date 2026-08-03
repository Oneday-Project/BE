import { ApiProperty } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    ArrayMinSize,
    IsArray,
    IsIn,
    IsInt,
    IsNumber,
    IsString,
    Max,
    Min,
} from 'class-validator';

const SCALE_VALUES = [0, 2.5, 5, 7.5, 10] as const;

const INTEREST_FIELDS = [
    'SML',
    'ML',
    'CV',
    'NLP',
    'Robotics',
    'Retrieval AI',
    'SAP',
    'HCI',
    'Multimodal',
    'Code AI',
] as const;

// Q9 대외 활동 - 준비된 항목 (복수 선택)
export const Q9_NONE = '아직 아무 것도 없어요';
export const Q9_OPTIONS = [
    Q9_NONE,
    'GitHub 포트폴리오',
    'CV(이력서)',
    '연구·학습 기록용 Notion',
    '공인 영어 성적 (TOEIC, TOEFL, OPIC 등)',
] as const;

// Q10 발표 경험 (복수 선택)
export const Q10_NONE = '없음';
export const Q10_OPTIONS = [
    Q10_NONE,
    '수업 프로젝트 발표',
    '동아리/스터디 발표',
    '교내 학술 발표',
    '학회 발표',
] as const;

// Q12 누적 평점(GPA) 구간 (단일 선택, 낮은 구간 -> 높은 구간 순서)
// 인덱스 * 2.5 점수로 환산 (0 / 2.5 / 5 / 7.5 / 10)
export const GPA_BANDS = [
    '2.5 미만',
    '2.5 이상 ~ 3.0 미만',
    '3.0 이상 ~ 3.5 미만',
    '3.5 이상 ~ 4.0 미만',
    '4.0 이상',
] as const;

export class AnalyzeRoadmapDto {
    @ApiProperty({ description: 'Q1 학년/학기 - 학년 (1~4)', example: 1 })
    @IsInt()
    @Min(1)
    @Max(4)
    year!: number;

    @ApiProperty({ description: 'Q1 학년/학기 - 학기 (1~2)', example: 2 })
    @IsInt()
    @Min(1)
    @Max(2)
    semester!: number;

    @ApiProperty({
        description: 'Q2 관심 분야 (아래 10개 중 최대 3개 선택)',
        example: ['SML', 'CV'],
        isArray: true,
        enum: INTEREST_FIELDS,
    })
    @IsArray()
    @IsString({ each: true })
    @IsIn(INTEREST_FIELDS, { each: true })
    @ArrayMinSize(1)
    @ArrayMaxSize(3)
    interestFields!: string[];

    @ApiProperty({
        description: 'Q3 선택한 관심 분야에 대한 이해도 (단일 선택, 0/2.5/5/7.5/10 중 하나)',
        example: 7.5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q3!: number;

    @ApiProperty({
        description: 'Q4 하고자 하는 연구의 구체화 정도 (단일 선택, 0/2.5/5/7.5/10 중 하나)',
        example: 5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q4!: number;

    @ApiProperty({
        description: 'Q5 프로젝트/대회 참여 경험 횟수 (단일 선택, 0/2.5/5/7.5/10 중 하나)',
        example: 5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q5!: number;

    @ApiProperty({
        description: 'Q6 연구실 인턴/학부 연구생 활동 경험 (단일 선택, 0/2.5/5/7.5/10 중 하나)',
        example: 2.5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q6!: number;

    @ApiProperty({
        description: 'Q7 한 달 평균 논문 읽는 편수 (단일 선택, 0/2.5/5/7.5/10 중 하나)',
        example: 5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q7!: number;

    @ApiProperty({
        description: 'Q8 논문 읽을 때 이해 수준 (단일 선택, 0/2.5/5/7.5/10 중 하나)',
        example: 7.5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q8!: number;

    @ApiProperty({
        description:
            "Q9 현재 준비된 항목 (복수 선택, 항목당 2.5점·최대 10점, '없음' 선택 시 0점)",
        example: ['GitHub 포트폴리오', 'CV(이력서)'],
        isArray: true,
        enum: Q9_OPTIONS,
    })
    @IsArray()
    @IsString({ each: true })
    @IsIn(Q9_OPTIONS, { each: true })
    q9!: string[];

    @ApiProperty({
        description:
            "Q10 기술 또는 연구 관련 발표 경험이 있나요? (복수 선택, 항목당 2.5점·최대 10점, '없음' 선택 시 0점)",
        example: ['수업 프로젝트 발표', '학회 발표'],
        isArray: true,
        enum: Q10_OPTIONS,
    })
    @IsArray()
    @IsString({ each: true })
    @IsIn(Q10_OPTIONS, { each: true })
    q10!: string[];

    @ApiProperty({
        description: 'Q11 수학/이론 이해 수준 (단일 선택, 0/2.5/5/7.5/10 중 하나)',
        example: 7.5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q11!: number;

    @ApiProperty({
        description:
            'Q12 현재 누적 평점(GPA) 구간 (단일 선택, 0/2.5/5/7.5/10 중 하나로 환산해 전달, 마지막 질문)',
        example: 7.5,
        enum: SCALE_VALUES,
    })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    gpaBand!: number;
}
