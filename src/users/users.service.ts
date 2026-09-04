import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/users.entity';
import { Not, Repository } from 'typeorm';
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
    const emailExists = await this.userRepository.exists({
      where: {
        email: user.email,
      },
    });

    if (emailExists) {
      throw new ConflictException('이미 가입한 이메일입니다!');
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

  findAllUser() {
    return this.userRepository.find({
      relations: {
        bookmarkPapers: true,
      },
    });
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
