import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { HaiPapersService } from './hai-papers.service';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';

@Controller('papers/hai-papers')
export class HaiPapersController {
  constructor(private readonly haiPapersService: HaiPapersService) {}

  @Post()
  createPaper(@Body() dto: CreateHAIpaperDto) {
    return this.haiPapersService.createPaper(dto);
  }

  @Get()
  getAllPapers() {
    return this.haiPapersService.getAllPapers();
  }

  @Patch(':id')
  updatePaper(
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdatHAIpaperDto,
  ){
    return this.haiPapersService.updatePaper(id, dto);
  }

  @Delete(':id')
  deletePaper(@Param('id', ParseIntPipe) id: number) {
    return this.haiPapersService.deletePaper(id);
  }
}
