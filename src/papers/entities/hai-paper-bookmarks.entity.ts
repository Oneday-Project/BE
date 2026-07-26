import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { HaiPaper } from './hai-papers.entity';
import { User } from 'src/users/entities/users.entity';

@Entity()
export class HaiPaperBookmark {
  @PrimaryColumn({
    name: 'haiPaperId',
    type: 'int',
  })
  haiPaperId!: number;

  @PrimaryColumn({
    name: 'userId',
    type: 'int',
  })
  userId!: number;

  @ManyToOne(() => HaiPaper, (haiPaper) => haiPaper.bookmarkUsers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'haiPaperId' })
  haiPaper!: HaiPaper;

  @ManyToOne(() => User, (user) => user.bookmarkHaiPapers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user!: User;
}
