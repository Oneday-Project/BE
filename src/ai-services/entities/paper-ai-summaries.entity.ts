import { BaseModel } from "src/common/entities/base.entity";
import { Paper } from "src/papers/entities/papers.entity";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class PaperAiSummary extends BaseModel{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    aiSummary!: string; // AI 종합 요약

    @Column()
    abstract_kor!: string;

    @Column()
    what!: string; // 이 논문은 무엇을 연구했는가?

    @Column() 
    how!: string; // 어떤 방법을 사용했는가?

    @Column()
    so_what!: string; // 결과/의의는?

    @Column()
    model!: string; // 사용한 AI 모델 버전

    @OneToOne(
        ()=>Paper, 
        (paper)=>paper.aiSummary,
        {
            onDelete: 'CASCADE',
        }
    )
    @JoinColumn() 
    paper!: Paper;
} 