import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('papers')
export class Papers {
    @PrimaryColumn()
    arxivId!: string;

    @Column({ nullable: true })
    doi!: string;

    @Column()
    title!: string; // 제목

    @Column('simple-json', {nullable: true })
    authors!: string[]; // 저자

    @Column({ type: 'text', nullable: true })
    abstract!: string; // 초록

    @Column('simple-json')
    category!: string[]; // 분야

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

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
