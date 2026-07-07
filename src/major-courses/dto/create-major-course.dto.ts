export class CreateMajorCourseDto {
        course_id!: string; // 과목 고유 ID

        name!: string; // 과목명

        professor?: string[]; // 교수명

        category!: string[]; // 분야(tag)

        level!: string; // 전선(전공선택) / 전심(전공심화)

        year_recommended!: number; // 권장 학년

        semester!: number; // 전공 과목 해당 학기

        description!: string; // 과목 설명
}
