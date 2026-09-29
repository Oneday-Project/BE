import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/users.entity';
import { Not, Repository } from 'typeorm';
import { AuthProviderEnum } from './const/auth-provider.const';
import {
  NICKNAME_ADJECTIVES,
  NICKNAME_MAX_ATTEMPTS,
  NICKNAME_NOUNS,
  NICKNAME_NUMBER_MAX,
} from './const/nickname-words.const';
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(
    user: Pick<User, 'username' | 'email' | 'nickname' | 'password'>,
  ) {
    // 1) nickname 중복이 없는지 확인
    // exists() -> 조건에 해당되는 값이 있으면 true 반환
    const nickNameExists = await this.userRepository.exists({
      where: {
        nickname: user.nickname,
      },
    });

    if (nickNameExists) {
      throw new ConflictException('이미 존재하는 nickname 입니다!');
    }

    // 2) email 중복이 없는지 확인
    // 샘물 계정은 email이 null일 수 있고, null끼리는 중복으로 보지 않으므로 값이 있을 때만 확인한다.
    if (user.email) {
      const emailExists = await this.userRepository.exists({
        where: {
          email: user.email,
        },
      });

      if (emailExists) {
        throw new ConflictException('이미 가입한 이메일입니다!');
      }
    }

    const userObject = this.userRepository.create({
      username: user.username,
      nickname: user.nickname,
      email: user.email,
      password: user.password,
    });

    const newUser = await this.userRepository.save(userObject);

    return newUser;
  }

  // 관리자용 전체 사용자 목록 - 프로필 정보만 조회
  // (북마크까지 붙이면 사용자 수 × 각자의 북마크 수만큼 행이 불어난다)
  findAllUser() {
    return this.userRepository.find();
  }

  // FK 조회/비밀번호 확인 등 내부용 - 관계 없이 가볍게 조회
  async findUserById(id: number) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    return user;
  }

  // /users/me 전용 - 프로필 정보만 가볍게 조회 (북마크/읽기 목록은 /papers/library 에서 페이지네이션으로 조회)
  async findMyInfo(id: number) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    return user;
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.exists({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    if (updateUserDto.nickname) {
      const nickNameExists = await this.userRepository.exists({
        where: {
          id: Not(id),
          nickname: updateUserDto.nickname,
        },
      });

      if (nickNameExists) {
        throw new ConflictException('이미 존재하는 nickname 입니다!');
      }
    }

    await this.userRepository.update({ id }, updateUserDto);

    return this.userRepository.findOne({
      where: {
        id,
      },
    });
  }

  async removeUser(id: number) {
    const user = await this.userRepository.exists({
      where: {
        id,
      },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    await this.userRepository.delete(id);

    return true;
  }

  // ══════════════════════════════════════════════════════════════════
  // 샘물(학교 계정) 로그인 전용
  // ══════════════════════════════════════════════════════════════════

  // 가드에서 사용하는 함수 - 토큰의 sub(사용자 id)로 조회한다.
  // findUserById()는 없으면 404를 던지지만, 가드에서는 "토큰은 유효하지만 사용자가 없다"를
  // 401로 돌려줘야 하므로 여기서는 에러를 던지지 않고 null을 반환한다.
  async findUserByIdOrNull(id: number) {
    return this.userRepository.findOne({
      where: {
        id,
      },
    });
  }

  // auth모듈에서 사용하는 함수 - 학번으로 샘물 사용자를 찾는다.
  async getUserByStudentId(studentId: string) {
    return this.userRepository.findOne({
      where: {
        studentId,
      },
    });
  }

  // 샘물 로그인 첫 사용자를 자동 가입시킨다.
  // 비밀번호와 이메일은 저장하지 않는다(학교 포털에서 인증하므로 필요 없고, 남길 이유도 없다).
  async createSmuUser(user: {
    studentId: string;
    username: string;
    department: string | null;
    secondDepartment: string | null;
  }) {
    const newUser = this.userRepository.create({
      username: user.username,
      nickname: await this.generateUniqueNickname(),
      email: null,
      password: null,
      studentId: user.studentId,
      department: user.department,
      secondDepartment: user.secondDepartment,
      authProvider: AuthProviderEnum.SMU,
    });

    try {
      return await this.userRepository.save(newUser);
    } catch (e) {
      // unique 제약 위반(23505)이 아니면 그대로 던진다.
      if ((e as { code?: string }).code !== '23505') {
        throw e;
      }

      // 같은 사람이 동시에 두 번 로그인해서 학번이 먼저 저장된 경우 - 그 계정을 쓰면 된다.
      const saved = await this.getUserByStudentId(user.studentId);

      if (saved) {
        return saved;
      }

      // 학번이 아니라 닉네임이 겹친 경우 - 겹치지 않는 닉네임으로 한 번 더 시도한다.
      newUser.nickname = `${newUser.nickname}${Date.now().toString().slice(-4)}`;

      return this.userRepository.save(newUser);
    }
  }

  // 샘물 로그인할 때마다 학교에서 받은 이름·학과 정보로 갱신한다(학과 변경, 복수전공 추가 반영).
  async syncSmuProfile(
    id: number,
    profile: {
      username: string;
      department: string | null;
      secondDepartment: string | null;
    },
  ) {
    await this.userRepository.update({ id }, profile);

    return this.findUserById(id);
  }

  // 닉네임 자동 생성 - "형용사 + 명사 + 숫자 4자리" (예: 성실한판다4821)
  // 학번이나 실명을 쓰지 않는다. 중복이면 몇 번 다시 만들어보고,
  // 그래도 실패하면 시간값을 붙여 확실히 겹치지 않는 닉네임을 만든다.
  private async generateUniqueNickname() {
    for (let attempt = 0; attempt < NICKNAME_MAX_ATTEMPTS; attempt++) {
      const nickname = this.buildRandomNickname();

      const exists = await this.userRepository.exists({
        where: {
          nickname,
        },
      });

      if (!exists) {
        return nickname;
      }
    }

    return `${this.buildRandomNickname()}${Date.now().toString().slice(-4)}`;
  }

  private buildRandomNickname() {
    const adjective =
      NICKNAME_ADJECTIVES[Math.floor(Math.random() * NICKNAME_ADJECTIVES.length)];
    const noun = NICKNAME_NOUNS[Math.floor(Math.random() * NICKNAME_NOUNS.length)];
    const number = Math.floor(Math.random() * NICKNAME_NUMBER_MAX)
      .toString()
      .padStart(4, '0');

    return `${adjective}${noun}${number}`;
  }

  // auth모듈에서 사용하는 함수
  async getUserByEmail(email: string) {
    return this.userRepository.findOne({
      where: {
        email,
      },
    }); // 여기서 null값이 반환된다면 존재X. 그렇지 않는다면 특정 사용자가 존재
  }

  // auth모듈에서 사용하는 함수
  async updatePassword(id: number, password: string) {
    await this.userRepository.update({ id }, { password });
    return true;
  }
}
