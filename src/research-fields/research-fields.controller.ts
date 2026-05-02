import { Body, Controller, Get, Post } from '@nestjs/common';
import { ResearchFieldsService } from './research-fields.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';

@Controller('research-fields')
export class ResearchFieldsController {
  constructor(private readonly researchFieldsService: ResearchFieldsService) {}

  @Get()
  getAllCategory(){
    return this.researchFieldsService.getAllresearchFields();
  }


  @Post()
  @Roles(RolesEnum.ADMIN)
  createCategory(
    @Body('name') name: string,
  ){
    return this.researchFieldsService.createCategory(name);
  }
}
