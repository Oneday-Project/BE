import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseModel } from 'src/common/entities/base.entity';
import { User } from 'src/users/entities/users.entity';
import { ResearchField } from 'src/research-fields/entities/research-fields.entity';
import { AlumniComment } from './alumni-comment.entity';
import { AlumniPostLike } from './alumni-post-like.entity';

@Entity()
export class AlumniPost extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  title!: string;

  @Column({
    type: 'text',
  })
  content!: string;

  @Column()
  authorId!: number;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Column()
  admissionYear!: number; // 학번년도

  @Column()
  graduationYear!: number; // 졸업년도

  @Column({
    nullable: true,
    default: '비공개',
  })
  gradSchoolName?: string; // 진학한 대학원명(선택, 미입력 시 "비공개")

  @Column()
  gradSchoolDept!: string; // 진학한 대학원 학과명(필수)

  @ManyToMany(() => ResearchField, (field) => field.alumniPosts)
  @JoinTable()
  researchFields!: ResearchField[]; // 분야 태그(다중 선택)

  @Column({
    default: 0,
  })
  likeCount!: number;

  @OneToMany(() => AlumniComment, (comment) => comment.post)
  comments!: AlumniComment[];

  @OneToMany(() => AlumniPostLike, (like) => like.post)
  likes!: AlumniPostLike[];
}
