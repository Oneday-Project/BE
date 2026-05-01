import { BaseModel } from "src/common/entities/base.entity";
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class MajorCourse extends BaseModel {
    @PrimaryColumn()
    course_id!: string; // 과목 고유 ID

    @Column()
    name!: string; // 과목명

    @Column('simple-json', {nullable: true})
    professor?: string[] = []; // 교수명

    @Column('simple-json')
    category!: string[]; // 분야(tag)

    @Column()
    level!: string; // 전공선택 / 전공심화

    @Column()
    year_recommended!: number; // 권장 학년

    @Column()
    semester!: number; // 전공 과목 해당 학기

    @Column('simple-json', {nullable: true})
    prereq_course_ids?: string[] = []; // 선수과목(선택)

    @Column({type: 'text'})
    description!: string; // 과목 설명
}
