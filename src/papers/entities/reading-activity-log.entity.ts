import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Paper } from './papers.entity';
import { User } from 'src/users/entities/users.entity';

// 캘린더/연속기록 계산 전용 일별 활동 로그
// (읽는 중 시작 / 완료 / 읽는 중인 논문 상세페이지 접속 시 upsert)
@Entity()
@Index(['userId', 'date'])
export class ReadingActivityLog {
    @PrimaryColumn({ name: 'paperId', type: 'text' })
    paperId!: string;

    @PrimaryColumn({ name: 'userId', type: 'int' })
    userId!: number;

    @PrimaryColumn({ name: 'date', type: 'date' })
    date!: string; // 'YYYY-MM-DD'

    @ManyToOne(() => Paper, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'paperId' })
    paper!: Paper;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;
}
