import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateMajorCourseDto {
        @IsNotEmpty()
        @IsString()
        course_id!: string; // 과목 고유 ID

        @IsNotEmpty()
        @IsString()
        name!: string; // 과목명

        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        professor?: string[]; // 교수명

        @IsArray()
        @IsString({ each: true })
        fields!: string[]; // 분야(tag)

        @IsNotEmpty()
        @IsString()
        level!: string; // 전공선택 / 전공심화 (source='biohealth' 면 초급/중급/고급)

        @IsOptional()
        @IsInt()
        year_recommended?: number; // 권장 학년 (전공과목 전용)

        @IsOptional()
        @IsInt()
        semester?: number; // 전공 과목 해당 학기 (전공과목 전용)

        @IsOptional()
        @IsIn(['major', 'biohealth'])
        source?: string; // 출처. 생략하면 'major'

        @IsOptional()
        @IsString()
        category?: string; // 바이오헬스 전공 (인공지능 / 디바이스 / 디노베이션 / 디자인 / 첨단바이오테크)

        @IsOptional()
        @IsInt()
        credit?: number; // 학점

        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        prereq_course_ids?: string[]; // 선수과목(선택)

        @IsNotEmpty()
        @IsString()
        description!: string; // 과목 설명
}
