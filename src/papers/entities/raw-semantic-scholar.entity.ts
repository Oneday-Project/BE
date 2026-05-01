import { BaseModel } from 'src/common/entities/base.entity';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('raw_semantic_scholar')
export class RawSemanticScholar extends BaseModel {
    @PrimaryColumn({ name: 'ss2_id' })
    ss2Id!: string; // ss2 자체 ID

    @Column({ nullable: true })
    doi!: string; // DOI

    @Column({ name: 'published_date', nullable: true })
    publishedDate!: string; // 발행일

    @Column({ name: 'citation_count', type: 'int', nullable: true })
    citationCount!: number; // 이 논문이 인용된 수(인용수)

    @Column({ name: 'influence_score', type: 'float', nullable: true })
    influenceScore!: number; // 영향력 지표

    @Column({ name: 'arxiv_id', nullable: false })
    arxivId!: string; // arxivId (raw_arxiv와 join 키)

    @Column({ nullable: true })
    journal!: string; // 저널 / 학회
}
