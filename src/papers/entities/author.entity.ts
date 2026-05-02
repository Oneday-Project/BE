// [변경] ManyToMany 역참조를 위해 ManyToMany 데코레이터 추가
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
// [변경] Papers 순환 참조 방지를 위해 forwardRef 패턴 사용
import { Papers } from "./papers.entity";
import { BaseModel } from "src/common/entities/base.entity";

@Entity()
export class Author extends BaseModel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    name!: string;

    @Column({nullable: true})
    authorId?: string;

    // [변경] Papers와의 ManyToMany 역참조 추가
    @ManyToMany(() => Papers, (paper) => paper.authors)
    papers!: Papers[];
}