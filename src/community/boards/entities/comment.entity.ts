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
import { Post } from './post.entity';
import { CommentLike } from './comment-like.entity';

@Entity()
export class Comment extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  postId!: number;

  @ManyToOne(() => Post, (post) => post.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'postId' })
  post!: Post;

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

  @ManyToOne(() => Comment, (comment) => comment.replies, {
    nullable: true,
    onDelete: 'RESTRICT', // 대댓글이 남아있는 댓글은 하드 삭제 불가(항상 isDeleted 소프트 삭제로만 처리 - 에브리타임처럼 대댓글은 계속 남음)
  })
  @JoinColumn({ name: 'parentId' })
  parent?: Comment;

  @OneToMany(() => Comment, (comment) => comment.parent)
  replies!: Comment[]; // 이 댓글의 대댓글 리스트

  @Column({
    default: false,
  })
  isDeleted!: boolean; // true면 조회 시 "삭제된 댓글입니다."로 표시(대댓글이 있는 댓글을 삭제한 경우)

  @Column({
    default: 0,
  })
  likeCount!: number; // 좋아요 수 비정규화 컬럼

  @OneToMany(() => CommentLike, (like) => like.comment)
  likes!: CommentLike[];
}
