import { BaseModel } from 'src/common/entities/base.entity';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class HaiPaper extends BaseModel{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ nullable: true })
    doi!: string;

    @Column()
    title!: string; // 제목

    @Column('simple-json', {nullable: true })
    authors!: string[]; // 저자

    @Column({nullable: true})
    academic_advisor!: string; // 지도 교수

    @Column({nullable: true})
    department!: string; // 학과

    @Column({ type: 'text', nullable: false })
    abstract!: string; // 초록

    @Column({ name: 'published_year', nullable: true })
    publishedYear!: string; // 발행년도

    @Column({ name: 'pdf_url', type: 'text', nullable: true })
    pdfUrl!: string; // pdf링크
}
