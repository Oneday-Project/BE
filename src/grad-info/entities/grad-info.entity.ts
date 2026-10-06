import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { ResearchField } from 'src/research-fields/entities/research-fields.entity';
import { GradInfoCategory, GradInfoDegreeType } from '../const/grad-info.const';

// 대학원 진학 정보 — 챗봇이 진학 관련 질문에 답할 때 읽는 자료.
//
// 사용자가 쓰는 게시판이 아니라 관리자가 직접 채우는 자료 모음이다. 그래서 작성자·좋아요·댓글이 없다.
// 한 행에는 한 주제만 담는다(본문이 길면 검색 정확도가 떨어지고, 프롬프트에는 앞부분만 들어간다).
@Entity('grad_info')
export class GradInfo extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'varchar',
    enum: GradInfoCategory,
  })
  category!: GradInfoCategory; // 자료의 종류 — 답변 규칙이 여기에 따라 달라진다

  @Column()
  title!: string;

  @Column({
    type: 'text',
  })
  content!: string; // 본문 — 챗봇이 실제로 읽는 내용

  @Column({
    type: 'varchar',
    nullable: true,
  })
  schoolName!: string | null; // 관련 대학원 (일반적인 팁이면 null)

  @Column({
    type: 'varchar',
    nullable: true,
  })
  department!: string | null; // 관련 학과·전공

  @Column({
    type: 'varchar',
    enum: GradInfoDegreeType,
    nullable: true,
  })
  degreeType!: GradInfoDegreeType | null; // 석사/박사/석박통합

  @ManyToMany(() => ResearchField, (field) => field.gradInfos)
  @JoinTable()
  researchFields!: ResearchField[]; // 분야 태그 — "CV 쪽으로 간 선배" 같은 질문에서 본문에 그 단어가 없어도 매칭되게 해준다

  // 정보의 기준 연도. 입시 일정·지원 제도는 해마다 바뀌므로, 챗봇이 "2026년 기준"이라고
  // 밝히고 최신 공고를 확인하라고 안내할 수 있게 저장한다.
  @Column({
    type: 'int',
    nullable: true,
  })
  referenceYear!: number | null;

  // ── 선배 진학 사례(category = case)에서만 사용 ──────────────────────
  @Column({
    type: 'int',
    nullable: true,
  })
  admissionYear!: number | null; // 학부 학번 (예: 2020 -> "20학번 선배")

  @Column({
    type: 'int',
    nullable: true,
  })
  entryYear!: number | null; // 대학원 입학 연도

  // 지우지 않고 챗봇 검색에서만 빼고 싶을 때 false로 둔다(지난해 입시 정보 등).
  @Column({
    default: true,
  })
  isPublished!: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  embedding?: string; // 챗봇 검색용 임베딩 벡터 — 기본 비선택(응답에서 제외)

  @Column({ nullable: true, select: false })
  embeddingHash?: string; // 임베딩을 만들 때 넣은 텍스트의 해시 — 내용이 바뀌었는데 임베딩이 옛것인지 판별용
}
