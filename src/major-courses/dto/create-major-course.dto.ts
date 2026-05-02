export class CreateMajorCourseDto {
        course_id!: string; // 과목 고유 ID

        name!: string; // 과목명

        professor?: string[]; // 교수명

        fields!: string[]; // 분야(tag)

        level!: string; // 전공선택 / 전공심화

        year_recommended!: number; // 권장 학년

        semester!: number; // 전공 과목 해당 학기

        prereq_course_ids!: string[]; // 선수과목(선택)

        description!: string; // 과목 설명
}
