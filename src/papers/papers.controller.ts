import { Controller, Get, Query } from '@nestjs/common';
import { PapersService } from './papers.service';
import { GetPapersDto } from './dto/get-papers.dto';

@Controller('papers')
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  @Get()
  getAllPapers(
    @Query() dto: GetPapersDto,
  ) {
    return this.papersService.getAllPapers(dto);
  }
}
