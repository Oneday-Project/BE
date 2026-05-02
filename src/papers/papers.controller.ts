import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PapersService } from './papers.service';
import { GetPapersDto } from './dto/get-papers.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';

@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  getAllPapers(
    @Query() dto: GetPapersDto,
  ) {
    return this.papersService.getAllPapers(dto);
  }

  // @Get()
  // getPaperByArxivId(
  //   @Query('arxivId') arxivId: string, 
  // ){

  // }

  @Get('category')
  getAllCategory(){
    return this.papersService.getAllCategories();
  }

  @Get('authors')
  @Roles(RolesEnum.ADMIN)
  getAllAuthors(){
    return this.papersService.getAllAuthors();
  }

  @Post('category')
  @Roles(RolesEnum.ADMIN)
  createCategory(
    @Body('name') name: string,
  ){
    return this.papersService.createCategory(name);
  }
}
