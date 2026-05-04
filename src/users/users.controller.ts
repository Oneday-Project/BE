import { Controller, Get, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors, ClassSerializerInterceptor, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from './const/roles.const';
import { IsMyInfoOrAdminGuard } from 'src/auth/guard/is-resource-mine-or-admin.guard';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
@Controller('users')
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


  @Get()
  @ApiOperation({
    description: '모든 사용자 정보를 가져오는 API', 
  })
  @Roles(RolesEnum.ADMIN)
  findAllUser() {
    return this.usersService.findAllUser();
  }

  @Get(':userId')
  @ApiOperation({
    description: 'userId 기반 단일 사용자 정보를 가져오는 API', 
  })
  @UseGuards(IsMyInfoOrAdminGuard)
  findUserById(@Param('userId', ParseIntPipe) id: number) {
    return this.usersService.findUserById(id);
  }

  @Patch(':userId')
  @ApiOperation({
    description: 'userId 기반 단일 사용자 정보를 수정하는 API', 
  })
  @UseGuards(IsMyInfoOrAdminGuard)
  updateUser(
    @Param('userId', ParseIntPipe) id: number, 
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete(':userId')
  @ApiOperation({
    description: 'userId 기반 단일 사용자 정보를 삭제하는 API', 
  })
  @UseGuards(IsMyInfoOrAdminGuard)
  removeUser(@Param('userId', ParseIntPipe) id: number) {
    return this.usersService.removeUser(id);
  }
}
