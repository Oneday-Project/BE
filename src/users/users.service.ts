import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/users.entity';
import { Repository } from 'typeorm';
import { AuthProviderEnum } from './const/auth-provider.const';
import {
  NICKNAME_ANIMALS,
  NICKNAME_PREFIXES,
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
    // email 중복이 없는지 확인 (nickname은 겹쳐도 되므로 확인하지 않는다)
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
      nickname: this.buildRandomNickname(),
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
      // 학번 unique 제약 위반(23505)은 같은 사람이 동시에 두 번 로그인한 경우다.
      // 먼저 저장된 계정을 그대로 쓰면 된다. 그 외 에러는 그대로 던진다.
      if ((e as { code?: string }).code !== '23505') {
        throw e;
      }

      const saved = await this.getUserByStudentId(user.studentId);

      if (!saved) {
        throw e;
      }

      return saved;
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

  // 닉네임 자동 생성 - "꾸밈말 + 동물" (예: 논문읽는판다). 숫자는 붙이지 않는다.
  // 닉네임은 unique가 아니므로 겹쳐도 그대로 쓴다(사용자 구분은 id와 학번이 한다).
  // 마음에 들지 않으면 PATCH /users/me 로 바꿀 수 있다.
  private buildRandomNickname() {
    const prefix =
      NICKNAME_PREFIXES[Math.floor(Math.random() * NICKNAME_PREFIXES.length)];
    const animal =
      NICKNAME_ANIMALS[Math.floor(Math.random() * NICKNAME_ANIMALS.length)];

    return `${prefix}${animal}`;
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
