import { BaseModel } from "src/common/entities/base.entity";
import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity()
export class MajorCourse extends BaseModel {
    @PrimaryColumn()
    course_id!: string; // 과목 고유 ID

    @Column()
    name!: string; // 과목명

    @Column('simple-json', { nullable: true })
    professor?: string[] = []; // 교수명

    @Column('simple-json')
    fields!: string[]; // 분야(tag) - 실제 DB 컬럼명: fields

    @Column()
    level!: string; // 전선(전공선택) / 전심(전공심화) — source='biohealth' 면 초급/중급/고급

    @Column({ nullable: true })
    year_recommended?: number; // 권장 학년 (전공과목 전용, 바이오헬스는 null)

    @Column({ nullable: true })
    semester?: number; // 전공 과목 해당 학기 (전공과목 전용, 바이오헬스는 null)

    @Column({ type: 'text' })
    description!: string; // 과목 설명

    // --- 바이오헬스 교과목 추가로 생긴 컬럼 ---
    // 결과 페이지 하단 '바이오헬스 추천 교과목' 섹션은 전공 로드맵 격자와 따로 렌더링되므로
    // source 로 두 집합을 완전히 분리해서 조회한다.
    @Index()
    @Column({ default: 'major' })
    source!: string; // 'major'(휴먼AI공학전공) | 'biohealth'(바이오헬스 온라인 교과목)

    @Column({ nullable: true })
    category?: string; // 바이오헬스 전공 (인공지능 / 디바이스 / 디노베이션 / 디자인 / 첨단바이오테크)

    @Column({ nullable: true })
    credit?: number; // 학점
}
