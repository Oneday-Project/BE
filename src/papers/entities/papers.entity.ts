import { BaseModel } from 'src/common/entities/base.entity';
import { Column, Entity, JoinTable, ManyToMany, OneToMany, OneToOne, PrimaryColumn } from 'typeorm';
import { Author } from './authors.entity';
import { ResearchField } from '../../research-fields/entities/research-fields.entity';
import { PaperAiSummary } from 'src/ai-services/entities/paper-ai-summaries.entity';
import { PaperBookmark } from './paper-bookmarks.entity';

@Entity()
export class Paper extends BaseModel {
    @PrimaryColumn()
    arxivId!: string;

    @Column({ nullable: true })
    doi!: string;

    @Column()
    title!: string; // 제목

    @ManyToMany(() => Author, (author) => author.papers, { cascade: true })
    @JoinTable()
    authors!: Author[];

    @Column({ type: 'text', nullable: true })
    abstract!: string; // 초록

    @ManyToMany(() => ResearchField, (category) => category.papers)
    @JoinTable()
    researchFields!: ResearchField[];

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

    @OneToMany(
        () => PaperBookmark,
        (pb) => pb.paper,
    )
    bookmarkUsers!: PaperBookmark[];

    @Column({
        default: 0
    })
    bookmarkCount!: number;
}
