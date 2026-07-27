import { Controller, Get, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors, ClassSerializerInterceptor, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from './const/roles.const';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { User } from './decorator/user.decorator';
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    description: '모든 사용자 정보를 가져오는 API(관리자 권한)', 
  })
  @Roles(RolesEnum.ADMIN)
  findAllUserByAdmin() {
    return this.usersService.findAllUser();
  }

  @Get('me')
  @ApiOperation({
    description: '사용자 자신의 정보를 가져오는 API', 
  })
  findMyInfo(@User('id') id: number) {
    return this.usersService.findMyInfo(id);
  }

  @Get(':userId')
  @ApiOperation({
    description: 'userId 기반 단일 사용자 정보를 가져오는 API(관리자 권한)', 
  })
  @Roles(RolesEnum.ADMIN)
  findUserByAdmin(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.findUserById(userId);
  }

  @Patch('me')
  @ApiOperation({
    description: '사용자 자신의 정보(닉네임)를 수정하는 API', 
  })
  updateMyInfo(
    @User('id') id: number, 
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Patch(':userId')
  @ApiOperation({
    description: 'userId 기반 단일 사용자 정보를 수정하는 API(관리자 권한)', 
  })
  @Roles(RolesEnum.ADMIN)
  updateUserByAdmin(
    @Param('userId', ParseIntPipe) id: number, 
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete('me')
  @ApiOperation({
    description: '사용자 자신의 정보를 삭제하는 API(회원 탈퇴)', 
  })
  removeMyInfo(@User('id') id: number) {
    return this.usersService.removeUser(id);
  }

  @Delete(':userId')
  @ApiOperation({
    description: 'userId 기반 단일 사용자 정보를 삭제하는 API(관리자 권한)', 
  })
  @Roles(RolesEnum.ADMIN)
  removeUserByAdmin(@Param('userId', ParseIntPipe) id: number) {
    return this.usersService.removeUser(id);
  }
}
