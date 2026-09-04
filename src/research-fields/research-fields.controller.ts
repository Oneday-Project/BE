import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { ResearchFieldsService } from './research-fields.service';
import { CreateResearchFieldDto } from './dto/create-research-field.dto';
import { UpdateResearchFieldDto } from './dto/update-research-field.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation } from '@nestjs/swagger';

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
    description: '연구분야를 생성하는 API(관리자 권한)', 
  })
  @ApiExcludeEndpoint() // 관리자 전용 — Swagger 문서에 노출하지 않는다
  @Roles(RolesEnum.ADMIN)
  createResearchField(
    @Body() dto: CreateResearchFieldDto,
  ){
    return this.researchFieldsService.createResearchField(dto);
  }


  @Patch(':id')
  @ApiOperation({
    description: 'id 기반 단일 연구분야를 수정하는 API(관리자 권한)',
  })
  @ApiExcludeEndpoint() // 관리자 전용 — Swagger 문서에 노출하지 않는다
  @Roles(RolesEnum.ADMIN)
  updateResearchField(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateResearchFieldDto,
  ){
    return this.researchFieldsService.updateResearchField(id, dto);
  }
}
