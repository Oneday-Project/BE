import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { HaiPaper } from './hai-papers.entity';
import { User } from 'src/users/entities/users.entity';

// 캘린더/연속기록 계산 전용 일별 활동 로그 (ReadingActivityLog와 동일한 구조, HaiPaper 전용)
@Entity()
@Index(['userId', 'date'])
export class HaiPaperActivityLog {
  @PrimaryColumn({ name: 'haiPaperId', type: 'int' })
  haiPaperId!: number;

  @PrimaryColumn({ name: 'userId', type: 'int' })
  userId!: number;

  @PrimaryColumn({ name: 'date', type: 'date' })
  date!: string; // 'YYYY-MM-DD'

  @ManyToOne(() => HaiPaper, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'haiPaperId' })
  haiPaper!: HaiPaper;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
