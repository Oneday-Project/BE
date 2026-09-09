import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/users.entity';
import { Post } from './post.entity';

@Entity()
export class PostLike extends BaseModel {
  @PrimaryColumn({
    name: 'postId',
    type: 'int',
  })
  postId!: number;

  @PrimaryColumn({
    name: 'userId',
    type: 'int',
  })
  userId!: number;

  @ManyToOne(() => Post, (post) => post.likes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'postId' })
  post!: Post;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
