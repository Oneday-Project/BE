import { Exclude } from 'class-transformer';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RolesEnum } from '../const/roles.const';
import { AuthProviderEnum } from '../const/auth-provider.const';
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

  // 샘물(학교 계정) 로그인으로 가입한 사용자는 이메일이 없을 수 있으므로 nullable.
  // PostgreSQL은 unique 컬럼에 NULL이 여러 개 있어도 제약을 위반하지 않는다.
  @Column({
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  email!: string | null;

  // 샘물 로그인 사용자는 학교 포털에서 인증하므로 비밀번호를 저장하지 않는다(null).
  @Column({
    type: 'varchar',
    nullable: true,
  })
  @Exclude({
    toPlainOnly: true,
  })
  password!: string | null; // 해시로 암호화된 PW (샘물 계정은 null)

  // ── 샘물(학교 계정) 로그인 관련 ─────────────────────────────────────
  // 학번. 샘물 사용자를 구분하는 키이고, 이메일로 가입한 사용자는 null이다.
  @Column({
    type: 'varchar',
    unique: true,
    nullable: true,
  })
  studentId!: string | null;

  // 학과(전공). 샘물 로그인할 때마다 학교 정보로 갱신하며, 사용자가 직접 수정할 수 없다.
  @Column({
    type: 'varchar',
    nullable: true,
  })
  department!: string | null;

  // 복수전공. 학교 응답에 없으면 null이다.
  @Column({
    type: 'varchar',
    nullable: true,
  })
  secondDepartment!: string | null;

  @Column({
    enum: AuthProviderEnum,
    default: AuthProviderEnum.LOCAL,
  })
  authProvider!: AuthProviderEnum;

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
