import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { HaiPapersService } from './hai-papers.service';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('papers/hai-papers')
@ApiBearerAuth()
export class HaiPapersController {
  constructor(private readonly haiPapersService: HaiPapersService) {}

  @Post()
  @ApiOperation({
    description: '휴먼과 논문 생성 API', 
  })
  createPaper(@Body() dto: CreateHAIpaperDto) {
    return this.haiPapersService.createHaiPaper(dto);
  }

  @Get()
  @ApiOperation({
    description: '모든 휴먼과 논문 가져오는 API', 
  })
  getAllPapers() {
    return this.haiPapersService.getAllHaiPapers();
  }

  @Get(':id')
  @ApiOperation({
    description: 'id 기반 단일 휴먼과 논문 가져오는 API', 
  })
  getPaper(@Param('id', ParseIntPipe) id: number) {
    return this.haiPapersService.getHaiPaper(id);
  }

  @Patch(':id')
  @ApiOperation({
    description: 'id 기반 단일 휴먼과 논문을 수정하는 API', 
  })
  updatePaper(
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdatHAIpaperDto,
  ){
    return this.haiPapersService.updateHaiPaper(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    description: 'id 기반 단일 휴먼과 논문을 삭제하는 API', 
  })
  deletePaper(@Param('id', ParseIntPipe) id: number) {
    return this.haiPapersService.deleteHaiPaper(id);
  }
}
