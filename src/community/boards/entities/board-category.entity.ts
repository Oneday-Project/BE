import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { Post } from './post.entity';

@Entity()
export class BoardCategory extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    unique: true,
  })
  name!: string; // 게시판 종류(ex. 대학원, 연구/논문, 진로, 학교생활, 기타)

  @OneToMany(() => Post, (post) => post.category)
  posts!: Post[];
}
