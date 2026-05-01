import { Exclude } from "class-transformer";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { RolesEnum } from "../const/roles.const";


@Entity()
export class User {
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
