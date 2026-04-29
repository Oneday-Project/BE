import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('raw_arxiv')
export class RawArxiv {
    @PrimaryColumn({ name: 'arxiv_id' })
    arxivId!: string;

    @Column({ nullable: true })
    title!: string; // 제목

    @Column('simple-json', {nullable: true })
    authors!: string[]; // 저자

    @Column({ type: 'text', nullable: true })
    abstract!: string; // 초록

    @Column('simple-json', { nullable: true })
    category!: string[]; // 분야

    @Column({ name: 'pdf_url', nullable: false })
    pdfUrl!: string; // pdf링크

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
