import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class UsersService {

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ){}

  findAllUser() {
    return this.userRepository.find();
  }


  async findOneUser(id: number) {
    const user = await this.userRepository.findOne({
      where: {
        id,
      }
    });

    if(!user){
      throw new NotFoundException('존재하지 않는 사용자입니다!');
    }

    return user;
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

    return this.userRepository.delete(id);
  }
}
