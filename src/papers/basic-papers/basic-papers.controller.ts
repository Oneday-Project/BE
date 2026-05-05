import { BadRequestException, Controller, Get, ParseIntPipe, Post, Query } from '@nestjs/common';
import { BasicPapersService } from './basic-papers.service';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';

@Controller('papers/basic-papers')
@ApiExcludeController()
@ApiBearerAuth()
export class BasicPapersController {
  constructor(private readonly basicPapersService: BasicPapersService) {}

  @Get('fetch-arxiv')
  async fetchArxiv(
    // 이 쿼리들은 나중에 DTO로 바꿔야함
    @Query('category') category: string = 'cs.AI',
    @Query('start', ParseIntPipe) start: number = 0,
    @Query('sort') sort?: string,
    @Query('startDate') startDate?: string, // YYYYMMDD 형식 (예: 20240101)
    @Query('endDate') endDate?: string,     // YYYYMMDD 형식 (예: 20240131)
  ) {
    return this.basicPapersService.fetchArxiv(category, start, sort, startDate, endDate);
  }

  @Get('fetch-ss')
  async fetchSs() {
    return this.basicPapersService.fetchSs();
  }

  @Get('fetch-by-ranking')
  async fetchByRanking(
    @Query('token') token?: string,
    @Query('query') query?: string,
    @Query('sort') sort?: string,       // 'influence' 넣으면 영향력 점수 기준, 생략 시 인용 수 기준
    @Query('field') field?: string,     // SS 분야 선택 (생략 시 기본값 Computer Science)
    @Query('category') category?: string, // AI 세부분야 선택 (예: cs.CV, cs.LG / 생략 시 AI 전체)
  ) {
    return this.basicPapersService.fetchByRanking(token, query, sort, field, category);
  }

  @Get('fetch-papers')
  async fetchPapers(@Query('arxivIds') arxivIds?: string) {
    if (!arxivIds) throw new BadRequestException('arxivIds 파라미터는 필수입니다. (예: 1706.03762 2301.00001)');
    return this.basicPapersService.fetchPapers(arxivIds);
  }


  @Post('integrate')
  async integrate() {
    return this.basicPapersService.integrate();
  }


  @Post('update-stats')
  async updateStats() {
    return this.basicPapersService.updateStats();
  }
}
