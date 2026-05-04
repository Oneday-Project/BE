import { Body, Controller, Get, Post } from '@nestjs/common';
import { ResearchFieldsService } from './research-fields.service';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('research-fields')
@ApiBearerAuth()
export class ResearchFieldsController {
  constructor(private readonly researchFieldsService: ResearchFieldsService) {}

  @Get()
  @ApiOperation({
    description: '모든 연구분야를 가져오는 API', 
  })
  getAllResearchFields(){
    return this.researchFieldsService.getAllResearchFields();
  }


  @Post()
  @ApiOperation({
    description: '연구분야를 생성하는 API', 
  })
  @Roles(RolesEnum.ADMIN)
  createResearchField(
    @Body('name') name: string,
  ){
    return this.researchFieldsService.createResearchField(name);
  }
}
