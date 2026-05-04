import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Paper } from "./papers.entity";
import { BaseModel } from "src/common/entities/base.entity";

@Entity()
export class Author extends BaseModel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column({nullable: true})
    authorId?: string;

    @ManyToMany(() => Paper, (paper) => paper.authors)
    papers!: Paper[];
}  