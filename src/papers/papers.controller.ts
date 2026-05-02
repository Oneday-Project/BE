import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PapersService } from './papers.service';
import { GetPapersDto } from './dto/get-papers.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';

@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  // 조건에 해당하는 모든 논문 GET
  @Get()
  getAllPapers(
    @Query() dto: GetPapersDto,
  ) {
    return this.papersService.getAllPapers(dto);
  }

  // arxivId 기반 단일 논문 GET
  @Get('paper/:arxivId')
  getPaperByArxivId(
    @Param('arxivId') arxivId: string,
  ){
    return this.papersService.getPaperByArxivId(arxivId);
  }

  @Get('authors')
  @Roles(RolesEnum.ADMIN)
  getAllAuthors(){
    return this.papersService.getAllAuthors();
  }

}
