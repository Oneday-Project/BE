import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { BoardPost } from './board-post.entity';

@Entity()
export class BoardCategory extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    unique: true,
  })
  name!: string; // 게시판 종류(ex. 대학원, 연구/논문, 진로, 학교생활, 기타)

  @OneToMany(() => BoardPost, (post) => post.category)
  posts!: BoardPost[];
}
