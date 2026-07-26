import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { HaiPaper } from './hai-papers.entity';
import { User } from 'src/users/entities/users.entity';
import { ReadingStatusEnum } from './paper-reading-status.entity';

// 유저별 휴먼과 논문 읽기 상태. row가 없으면 안읽음으로 취급한다. (PaperReadingStatus와 동일한 구조, HaiPaper 전용)
@Entity()
export class HaiPaperReadingStatus {
  @PrimaryColumn({ name: 'haiPaperId', type: 'int' })
  haiPaperId!: number;

  @PrimaryColumn({ name: 'userId', type: 'int' })
  userId!: number;

  @ManyToOne(() => HaiPaper, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'haiPaperId' })
  haiPaper!: HaiPaper;

  @ManyToOne(() => User, (user) => user.readingHaiPapers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'enum', enum: ReadingStatusEnum })
  status!: ReadingStatusEnum;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;
}
