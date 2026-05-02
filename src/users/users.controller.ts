import { Controller, Get, Body, Patch, Param, Delete, ParseIntPipe, UseInterceptors, ClassSerializerInterceptor, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { RolesEnum } from './const/roles.const';
import { IsMyInfoOrAdminGuard } from 'src/auth/guard/is-resource-mine-or-admin.guard';
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


  @Get()
  @Roles(RolesEnum.ADMIN)
  findAllUser() {
    return this.usersService.findAllUser();
  }

  @Get(':userId')
  @UseGuards(IsMyInfoOrAdminGuard)
  findUserById(@Param('userId', ParseIntPipe) id: number) {
    return this.usersService.findUserById(id);
  }

  @Patch(':userId')
  @UseGuards(IsMyInfoOrAdminGuard)
  updateUser(
    @Param('userId', ParseIntPipe) id: number, 
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete(':userId')
  @UseGuards(IsMyInfoOrAdminGuard)
  removeUser(@Param('userId', ParseIntPipe) id: number) {
    return this.usersService.removeUser(id);
  }
}
