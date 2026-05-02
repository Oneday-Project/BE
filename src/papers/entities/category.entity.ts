// [변경] ManyToMany 역참조를 위해 ManyToMany 데코레이터 추가
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
// [변경] Papers 역참조 추가
import { Papers } from "./papers.entity";

@Entity()
export class Category {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({
        unique: true,
    })
    name!: string;

    // [변경] Papers와의 ManyToMany 역참조 추가
    @ManyToMany(() => Papers, (paper) => paper.categories)
    papers!: Papers[];
}