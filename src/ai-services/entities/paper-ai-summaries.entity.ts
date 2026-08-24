import { BaseModel } from "src/common/entities/base.entity";
import { Paper } from "src/papers/entities/papers.entity";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class PaperAiSummary extends BaseModel{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    whyRead!: string; // 내가 왜 읽어야 하는가. 중요도에 따라 답변 뉘앙스 달라짐

    @Column()
    abstractKor!: string; // 초록 한국어 번역

    @Column()
    what!: string; // 무엇을 연구 했는가(초록보다 구체적으로) 

    @Column() 
    how!: string; // 어떤 방식으로 했는가(초록보다 구체적으로)

    @Column()
    impact!: string; // 결과 + 미래 영향

    @Column()
    model!: string; // 사용한 AI 모델 버전

    @Column()
    cardSummary!: string;

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