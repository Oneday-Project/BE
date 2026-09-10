import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/users.entity';
import { BoardComment } from './board-comment.entity';

@Entity()
export class BoardCommentLike extends BaseModel {
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

  @ManyToOne(() => BoardComment, (comment) => comment.likes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'commentId' })
  comment!: BoardComment;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
