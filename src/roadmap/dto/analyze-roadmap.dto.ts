import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

const SCALE_VALUES = [0, 2.5, 5, 7.5, 10] as const;

export class AnalyzeRoadmapDto {
    @ApiProperty({ description: '학년 (1~4)', example: 2 })
    @IsInt()
    @Min(1)
    @Max(4)
    year!: number;

    @ApiProperty({ description: '학기 (1~2)', example: 1 })
    @IsInt()
    @Min(1)
    @Max(2)
    semester!: number;

    @ApiProperty({
        description: '관심 분야 (최대 3개)',
        example: ['CV', 'LLM'],
        isArray: true,
    })
    @IsArray()
    @IsString({ each: true })
    @ArrayMaxSize(3)
    interestFields!: string[];

    @ApiProperty({ description: 'Q3 점수 (0, 2.5, 5, 7.5, 10 중 하나)', example: 7.5 })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q3!: number;

    @ApiProperty({ description: 'Q4 점수 (0, 2.5, 5, 7.5, 10 중 하나)', example: 5 })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q4!: number;

    @ApiProperty({ description: 'Q5 점수 - 프로젝트 경험 (0, 2.5, 5, 7.5, 10 중 하나)', example: 5 })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q5!: number;

    @ApiProperty({ description: 'Q6 점수 (0, 2.5, 5, 7.5, 10 중 하나)', example: 2.5 })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q6!: number;

    @ApiProperty({ description: 'Q7 점수 - 연구 경험 (0, 2.5, 5, 7.5, 10 중 하나)', example: 5 })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q7!: number;

    @ApiProperty({ description: 'Q8 점수 (0, 2.5, 5, 7.5, 10 중 하나)', example: 7.5 })
    @IsNumber()
    @IsIn(SCALE_VALUES)
    q8!: number;

    @ApiProperty({
        description: 'Q9 다중 선택 답변 (항목당 2.5점, 최대 10점)',
        example: ['논문 읽기', '세미나 참여'],
        isArray: true,
    })
    @IsArray()
    @IsString({ each: true })
    q9!: string[];

    @ApiProperty({
        description: 'Q10 다중 선택 답변 (항목당 2.5점, 최대 10점)',
        example: ['GitHub', 'Kaggle'],
        isArray: true,
    })
    @IsArray()
    @IsString({ each: true })
    q10!: string[];

    @ApiProperty({ description: 'Q11 점수 (0~10)', example: 8 })
    @IsNumber()
    @Min(0)
    @Max(10)
    q11!: number;

    @ApiProperty({ description: 'Q12 점수 (0~10)', example: 6 })
    @IsNumber()
    @Min(0)
    @Max(10)
    q12!: number;

    @ApiPropertyOptional({ description: '학점 구간 (선택)', example: '3.5~4.0' })
    @IsString()
    @IsOptional()
    gpaBand?: string;
}
