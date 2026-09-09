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
import { AlumniPost } from './alumni-post.entity';
import { AlumniCommentLike } from './alumni-comment-like.entity';

@Entity()
export class AlumniComment extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  postId!: number;

  @ManyToOne(() => AlumniPost, (post) => post.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'postId' })
  post!: AlumniPost;

  @Column()
  authorId!: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Column({
    type: 'text',
  })
  content!: string;

  @Column({
    nullable: true,
  })
  parentId?: number; // null이면 최상위 댓글, 값이 있으면 대댓글(2단계까지만 허용 - 서비스 레벨에서 검증)

  @ManyToOne(() => AlumniComment, (comment) => comment.replies, {
    nullable: true,
    onDelete: 'RESTRICT', // 대댓글이 남아있는 댓글은 하드 삭제 불가(항상 isDeleted 소프트 삭제로만 처리)
  })
  @JoinColumn({ name: 'parentId' })
  parent?: AlumniComment;

  @OneToMany(() => AlumniComment, (comment) => comment.parent)
  replies!: AlumniComment[];

  @Column({
    default: false,
  })
  isDeleted!: boolean; // true면 조회 시 "삭제된 댓글입니다."로 표시(대댓글이 있는 댓글을 삭제한 경우)

  @Column({
    default: 0,
  })
  likeCount!: number;

  @OneToMany(() => AlumniCommentLike, (like) => like.comment)
  likes!: AlumniCommentLike[];
}
