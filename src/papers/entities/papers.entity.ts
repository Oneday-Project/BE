import { BaseModel } from 'src/common/entities/base.entity';
// [변경] ManyToMany, JoinTable 데코레이터 추가
import { Column, Entity, JoinTable, ManyToMany, OneToOne, PrimaryColumn } from 'typeorm';
// [변경] Author, Category 엔티티 임포트 추가
import { Author } from './author.entity';
import { Category } from './category.entity';
import { PaperAiSummary } from 'src/ai-services/entities/paper-ai-summaries.entity';

@Entity('papers')
export class Papers extends BaseModel {
    @PrimaryColumn()
    arxivId!: string;

    @Column({ nullable: true })
    doi!: string;

    @Column()
    title!: string; // 제목

    // [변경] authors: string[] (simple-json) → Author 테이블과 ManyToMany FK 관계
    @ManyToMany(() => Author, (author) => author.papers, { cascade: ['insert'] })
    @JoinTable({ name: 'paper_authors' })
    authors!: Author[];

    @Column({ type: 'text', nullable: true })
    abstract!: string; // 초록

    // [변경] category: string[] (simple-json) → Category 테이블과 ManyToMany FK 관계
    @ManyToMany(() => Category, (category) => category.papers)
    @JoinTable({ name: 'paper_categories' })
    categories!: Category[];

    @Column({ name: 'published_date', nullable: true })
    publishedDate!: string; // 발행일

    @Column({ name: 'citation_count', type: 'int', nullable: true })
    citationCount!: number; // 이 논문이 인용된 수(인용수)

    @Column({ name: 'influence_score', type: 'float', nullable: true })
    influenceScore!: number; // 영향력 지표

    @Column({ nullable: true })
    journal!: string; // 저널 / 학회

    @Column({ name: 'pdf_url', nullable: false })
    pdfUrl!: string; // pdf링크

    @OneToOne(()=>PaperAiSummary, (aiSummary)=>aiSummary.paper)
    aiSummary!: PaperAiSummary;
}
