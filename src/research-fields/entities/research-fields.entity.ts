import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Papers } from "../../papers/entities/papers.entity";
import { BaseModel } from "src/common/entities/base.entity";

@Entity()
export class ResearchField extends BaseModel{
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        unique: true,
    })
    name!: string;

    @ManyToMany(() => Papers, (paper) => paper.researchFields)
    papers!: Papers[];
}     