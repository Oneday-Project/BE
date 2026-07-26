import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Paper } from './papers.entity';
import { User } from 'src/users/entities/users.entity';

export enum ReadingStatusEnum {
  READING = 'reading',
  COMPLETED = 'completed',
}

// 유저별 논문 읽기 상태(읽는 중 / 읽기 완료). row가 없으면 안읽음으로 취급한다.
@Entity()
export class PaperReadingStatus {
  @PrimaryColumn({ name: 'paperId', type: 'text' })
  paperId!: string;

  @PrimaryColumn({ name: 'userId', type: 'int' })
  userId!: number;

  @ManyToOne(() => Paper, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paperId' })
  paper!: Paper;

  @ManyToOne(() => User, (user) => user.readingPapers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'enum', enum: ReadingStatusEnum })
  status!: ReadingStatusEnum;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
