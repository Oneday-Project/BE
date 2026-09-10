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
import { BoardComment } from './board-comment.entity';
import { BoardPostLike } from './board-post-like.entity';

@Entity()
export class BoardPost extends BaseModel {
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

  @OneToMany(() => BoardComment, (comment) => comment.post)
  comments!: BoardComment[];

  @OneToMany(() => BoardPostLike, (like) => like.post)
  likes!: BoardPostLike[];

  @Column({ type: 'text', nullable: true, select: false })
  embedding?: string; // 챗봇 검색용 임베딩 벡터 — 기본 비선택(프론트 응답에서 제외)

  @Column({ nullable: true, select: false })
  embeddingHash?: string; // 임베딩을 만들 때 넣은 텍스트의 해시 — 글이 바뀌었는데 임베딩이 옛것인지 판별용
}
