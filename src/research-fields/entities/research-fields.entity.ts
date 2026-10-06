import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Paper } from "../../papers/entities/papers.entity";
import { BaseModel } from "src/common/entities/base.entity";
import { GradInfo } from "src/grad-info/entities/grad-info.entity";

@Entity()
export class ResearchField extends BaseModel{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        unique: true,
    })
    name!: string;

    @Column({
        nullable: true,
        unique: true,
    })
    tag!: string; // 검색/화면 표시용 짧은 라벨(예: cs.CV -> CV)

    @ManyToMany(() => Paper, (paper) => paper.researchFields)
    papers!: Paper[];

    @ManyToMany(() => GradInfo, (gradInfo) => gradInfo.researchFields)
    gradInfos!: GradInfo[];
}