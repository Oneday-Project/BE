import { BaseModel } from "src/common/entities/base.entity";
import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class MajorCourse extends BaseModel {
    @PrimaryColumn()
    course_id!: string; // 과목 고유 ID

    @Column()
    name!: string; // 과목명

    @Column('simple-json', { nullable: true })
    professor?: string[] = []; // 교수명

    @Column('simple-json')
    fields!: string[]; // 분야(tag) - 실제 DB 컬럼명: category

    @Column()
    level!: string; // 전선(전공선택) / 전심(전공심화)

    @Column()
    year_recommended!: number; // 권장 학년

    @Column()
    semester!: number; // 전공 과목 해당 학기

    @Column({ type: 'text' })
    description!: string; // 과목 설명
}
