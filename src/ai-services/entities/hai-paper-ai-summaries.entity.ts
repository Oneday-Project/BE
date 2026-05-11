import { BaseModel } from "src/common/entities/base.entity";
import { HaiPaper } from "src/papers/entities/hai-papers.entity";
import { Paper } from "src/papers/entities/papers.entity";
import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class HaiPaperAiSummary extends BaseModel{
    @PrimaryGeneratedColumn()
    id!: number;

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

    @OneToOne(
        ()=>HaiPaper, 
        (haiPaper)=>haiPaper.aiSummary,
        {
            onDelete: 'CASCADE',
        }
    )
    @JoinColumn() 
    haiPaper!: HaiPaper;
} 