import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/users.entity';
import { BoardCategory } from './board-category.entity';
import { Comment } from './comment.entity';
import { PostLike } from './post-like.entity';

@Entity()
export class Post extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string; // 글 제목

  @Column({
    type: 'text',
  })
  content!: string; // 글 내용

  @Column()
  authorId!: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Column()
  categoryId!: number;

  @ManyToOne(() => BoardCategory, (category) => category.posts)
  @JoinColumn({ name: 'categoryId' })
  category!: BoardCategory;

  @Column({
    default: 0,
  })
  likeCount!: number; // 좋아요 수

  @OneToMany(() => Comment, (comment) => comment.post)
  comments!: Comment[];

  @OneToMany(() => PostLike, (like) => like.post)
  likes!: PostLike[];
}
