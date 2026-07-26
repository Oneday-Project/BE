import { HaiPaperAiSummary } from 'src/ai-services/entities/hai-paper-ai-summaries.entity';
import { BaseModel } from 'src/common/entities/base.entity';
import {
  Column,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HaiPaperBookmark } from './hai-paper-bookmarks.entity';

@Entity()
export class HaiPaper extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: true })
  doi!: string;

  @Column()
  title!: string; // 제목

  @Column('simple-json', { nullable: true })
  authors!: string[]; // 저자

  @Column({ nullable: true })
  academic_advisor!: string; // 지도 교수

  @Column({ nullable: true })
  department!: string; // 학과

  @Column({ type: 'text', nullable: false })
  abstract!: string; // 초록

  @Column({ name: 'published_year', nullable: true })
  publishedYear!: string; // 발행년도

  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl!: string; // pdf링크

  @OneToOne(() => HaiPaperAiSummary, (aiSummary) => aiSummary.haiPaper)
  aiSummary!: HaiPaperAiSummary;

  @Column({ type: 'text', nullable: true, select: false })
  embedding?: string; // 임베딩 벡터 — 기본 비선택(프론트 응답에서 제외), 필요 시 select로 명시 조회

  @OneToMany(() => HaiPaperBookmark, (b) => b.haiPaper)
  bookmarkUsers!: HaiPaperBookmark[];

  @Column({
    default: 0,
  })
  bookmarkCount!: number;
}
