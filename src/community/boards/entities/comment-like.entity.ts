import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/users.entity';
import { Comment } from './comment.entity';

@Entity()
export class CommentLike extends BaseModel {
  @PrimaryColumn({
    name: 'commentId',
    type: 'int',
  })
  commentId!: number;

  @PrimaryColumn({
    name: 'userId',
    type: 'int',
  })
  userId!: number;

  @ManyToOne(() => Comment, (comment) => comment.likes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'commentId' })
  comment!: Comment;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
