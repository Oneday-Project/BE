import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/users.entity';
import { Repository } from 'typeorm';
@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ){}

  async createUser(user: Pick<User, 'username' | 'email' | 'nickname' | 'password'>){
    // 1) nickname 중복이 없는지 확인
    // exists() -> 조건에 해당되는 값이 있으면 true 반환
    const nickNameExists = await this.userRepository.exists({
      where: {
          nickname: user.nickname,
      }
    });

    if(nickNameExists){
      throw new BadRequestException('이미 존재하는 nickname 입니다!')
    }

    // 2) email 중복이 없는지 확인
    const emailExists = await this.userRepository.exists({
      where: {
          email: user.email,
      }
    });

    if(emailExists){
      throw new BadRequestException('이미 가입한 이메일입니다!')
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
      }
    });
  }


  async findUserById(id: number) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      },
      relations: {
        bookmarkPapers: true,
      }
    });

    if(!user){
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    return user;
  }

  // auth모듈에서 사용하는 함수
  async getUserByEmail(email: string){
    return this.userRepository.findOne({
        where: {
            email,
        },
    }) // 여기서 null값이 반환된다면 존재X. 그렇지 않는다면 특정 사용자가 존재
  }


  async updateUser(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      }
    });

    if(!user){
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    await this.userRepository.update(
      {id},
      updateUserDto,
    )

    return this.userRepository.findOne({
      where:{
        id,
      },
    });
  }


  async removeUser(id: number) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      }
    });

    if(!user){
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    this.userRepository.delete(id);

    return `id:${id}인 사용자 삭제완료`; 
  }
}
