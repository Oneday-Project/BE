import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

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
        level!: string; // 전공선택 / 전공심화

        @IsInt()
        year_recommended!: number; // 권장 학년

        @IsInt()
        semester!: number; // 전공 과목 해당 학기

        @IsOptional()
        @IsArray()
        @IsString({ each: true })
        prereq_course_ids?: string[]; // 선수과목(선택)

        @IsNotEmpty()
        @IsString()
        description!: string; // 과목 설명
}
