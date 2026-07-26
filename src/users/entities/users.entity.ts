import { Exclude } from 'class-transformer';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolesEnum } from '../const/roles.const';
import { BaseModel } from 'src/common/entities/base.entity';
import { PaperBookmark } from 'src/papers/entities/paper-bookmarks.entity';
import { HaiPaperBookmark } from 'src/papers/entities/hai-paper-bookmarks.entity';
import { PaperReadingStatus } from 'src/papers/entities/paper-reading-status.entity';
import { HaiPaperReadingStatus } from 'src/papers/entities/hai-paper-reading-status.entity';

@Entity()
export class User extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  username!: string;

  @Column({
    unique: true,
  })
  nickname!: string;

  @Column({
    unique: true,
  })
  email!: string;

  @Column()
  @Exclude({
    toPlainOnly: true,
  })
  password!: string; // 해시로 암호화된 PW

  @Column({
    enum: RolesEnum,
    default: RolesEnum.USER,
  })
  role!: RolesEnum;

  @OneToMany(() => PaperBookmark, (pb) => pb.user)
  bookmarkPapers!: PaperBookmark[];

  @OneToMany(() => HaiPaperBookmark, (b) => b.user)
  bookmarkHaiPapers!: HaiPaperBookmark[];

  @OneToMany(() => PaperReadingStatus, (s) => s.user)
  readingPapers!: PaperReadingStatus[];

  @OneToMany(() => HaiPaperReadingStatus, (s) => s.user)
  readingHaiPapers!: HaiPaperReadingStatus[];
}
