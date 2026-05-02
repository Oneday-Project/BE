import { Exclude } from "class-transformer";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { RolesEnum } from "../const/roles.const";
import { BaseModel } from "src/common/entities/base.entity";


@Entity()
export class User extends BaseModel {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    username!: string;

    @Column({
        unique: true,
    })
    nickname!: string;

    @Column({
        unique: true,
    })
    email!: string;

    @Column()
    @Exclude({
        toPlainOnly: true,
    })
    password!: string;

    @Column({
        enum: RolesEnum,
        default: RolesEnum.USER,
    })
    role!: RolesEnum;
} 
