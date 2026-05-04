import { Controller, Get, Param, Post, Query, UseInterceptors } from '@nestjs/common';
import { PapersService } from './papers.service';
import { GetPapersDto } from './dto/get-papers.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';
import { User } from 'src/users/decorator/user.decorator';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';
import type { QueryRunner as QR } from 'typeorm';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { IsPublic } from 'src/common/decorator/is-public.decorator';

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
    @Query() dto: GetPapersDto,
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
  ){
    return this.papersService.getPaperByArxivId(arxivId);
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
  getAllAuthors(){
    return this.papersService.getAllAuthors();
  }

}
