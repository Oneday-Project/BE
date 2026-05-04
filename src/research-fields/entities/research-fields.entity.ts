import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Paper } from "../../papers/entities/papers.entity";
import { BaseModel } from "src/common/entities/base.entity";

@Entity()
export class ResearchField extends BaseModel{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        unique: true,
    })
    name!: string;

    @ManyToMany(() => Paper, (paper) => paper.researchFields)
    papers!: Paper[];
}     