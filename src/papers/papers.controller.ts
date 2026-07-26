import { Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseInterceptors } from '@nestjs/common';
import { PapersService } from './papers.service';
import { GetPapersPaginationDto } from './dto/get-papers-pagination.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';
import { User } from 'src/users/decorator/user.decorator';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';
import type { QueryRunner as QR } from 'typeorm';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { GetAuthorsPaginationDto } from './dto/get-authors-pagination.dto';
import { GetReadingCalendarDto } from './dto/get-reading-calendar.dto';

@Controller('papers')
@ApiBearerAuth()
export class PapersController {
  constructor(private readonly papersService: PapersService) {}

  // 조건에 해당하는 모든 논문 GET
  @Get()
  @ApiOperation({
    description: '모든 기본 논문들을 가져오는 API', 
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    example: ['cs.CV', 'cs.HC'],
    description: '태그 기반 검색',
    isArray: true,
  })
  @ApiQuery({
    name: 'order',
    required: false,
    example: ['influenceScore_DESC'],
    description: '컬럼 기반 내림차 또는 오름차 정렬',
    isArray: true,
  })
  @IsPublic()
  getAllPapers(
    @Query() dto: GetPapersPaginationDto,
  ) {
    return this.papersService.getAllPapers(dto);
  }

  
  // arxivId 기반 단일 논문 GET
  @Get('paper/:arxivId')
  @ApiOperation({
    description: 'arxivId 기반 단일 논문을 가져오는 API',
  })
  getPaperByArxivId(
    @Param('arxivId') arxivId: string,
    @User('id') userId: number,
  ){
    return this.papersService.getPaperByArxivId(arxivId, userId);
  }


  @Post('paper/:arxivId/reading-status')
  @ApiOperation({
    description: '읽는 중 상태를 토글(시작/취소)하는 API',
  })
  @UseInterceptors(TransactionInterceptor)
  toggleReadingStatus(
    @Param('arxivId') arxivId: string,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ){
    return this.papersService.toggleReadingStatus(arxivId, userId, qr);
  }


  @Post('paper/:arxivId/reading-status/complete')
  @ApiOperation({
    description: '읽기 완료로 전환하는 API',
  })
  @UseInterceptors(TransactionInterceptor)
  completeReadingStatus(
    @Param('arxivId') arxivId: string,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ){
    return this.papersService.completeReading(arxivId, userId, qr);
  }


  @Get('reading-status/calendar')
  @ApiOperation({
    description: '월간 읽기 캘린더/요약/연속기록 조회 API',
  })
  getReadingCalendar(
    @Query() dto: GetReadingCalendarDto,
    @User('id') userId: number,
  ){
    return this.papersService.getReadingCalendar(userId, dto);
  }


  @Get('reading-status/continue')
  @ApiOperation({
    description: '이어서 읽어볼까요(읽는 중 논문) 목록 조회 API',
  })
  getContinueReadingPapers(
    @User('id') userId: number,
  ){
    return this.papersService.getContinueReadingPapers(userId);
  }


  @Post('bookmark/:arxivId')
  @ApiOperation({
    description: '북마크를 표시/해제하는 API', 
  })
  @UseInterceptors(TransactionInterceptor)
  togglePaperBookmark(
    @Param('arxivId') arxivId: string,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ){
    return this.papersService.togglePaperBookmark(arxivId, userId, qr);
  }


  @Get('authors')
  @ApiOperation({
    description: '기본 논문의 모든 저자들을 가져오는 API',
  })
  @Roles(RolesEnum.ADMIN)
  getAllAuthors(
    @Query() dto: GetAuthorsPaginationDto,
  ){
    return this.papersService.getAllAuthors(dto);
  }


  @Post('star-tiers')
  @ApiExcludeEndpoint()
  @ApiOperation({
    description: '각 논문의 별점 티어를 할당하는 API',
  })
  @Roles(RolesEnum.ADMIN)
  assignStarTiers(){
    return this.papersService.assignStarTiers();
  }

  
  @Delete()
  @ApiExcludeEndpoint()
  @ApiOperation({
    description: '기본 논문 삭제 API',
  })
  @Roles(RolesEnum.ADMIN)
  deletePapers(
    @Query('arxivIds') arxivIds?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.papersService.deletePapers(arxivIds, startDate, endDate);
  }



  @Post('paper/:arxivId/embedding')
  @ApiOperation({ description: '단일 논문에 랜덤 임베딩 벡터 할당 API' })
  @ApiExcludeEndpoint()
  saveTestEmbedding(@Param('arxivId') arxivId: string) {
      return this.papersService.saveTestEmbedding(arxivId);
  }

  @Get('paper/:arxivId/similar')
  @IsPublic()
  @ApiOperation({ description: '유사 논문 추천 API' })
  getSimilarPapers(
      @Param('arxivId') arxivId: string,
      @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
      return this.papersService.getSimilarPapers(arxivId, limit);
  }

}
