import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { HaiPapersService } from './hai-papers.service';
import { CreateHAIpaperDto } from './dto/create-hai-paper.dto';
import { UpdatHAIpaperDto } from './dto/update-hai-paper.dto';
import { GetHaiPapersPaginationDto } from './dto/get-hai-papers-pagination.dto';
import { ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RolesEnum } from 'src/users/const/roles.const';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { User } from 'src/users/decorator/user.decorator';
import { OptionalUser } from 'src/users/decorator/optional-user.decorator';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';
import { TransactionInterceptor } from 'src/common/interceptor/transaction.interceptor';
import { QueryRunner } from 'src/common/decorator/query-runner.decorator';
import type { QueryRunner as QR } from 'typeorm';

@Controller('papers/hai-papers')
@ApiBearerAuth()
export class HaiPapersController {
  constructor(private readonly haiPapersService: HaiPapersService) {}

  @Get()
  @ApiOperation({
    description: '모든 휴먼과 논문 가져오는 API',
  })
  @ApiQuery({
    name: 'tags',
    required: false,
    example: ['CV', 'LLM'],
    description: '분야(태그) 기반 검색',
    isArray: true,
  })
  @ApiQuery({
    name: 'department',
    required: false,
    example: ['이의철 교수 연구실'],
    description: '연구실 기반 검색(다중 선택 가능)',
    isArray: true,
  })
  @ApiQuery({
    name: 'order',
    required: false,
    example: ['publishedYear_DESC'],
    description: '컬럼 기반 내림차 또는 오름차 정렬',
    isArray: true,
  })
  @IsPublic()
  @UseGuards(OptionalAuthGuard)
  getAllPapers(
    @Query() dto: GetHaiPapersPaginationDto,
    @OptionalUser('id') userId?: number,
  ) {
    return this.haiPapersService.getAllHaiPapers(dto, userId);
  }

  @Get(':id')
  @ApiOperation({
    description: 'id 기반 단일 휴먼과 논문 가져오는 API',
  })
  getPaper(@Param('id', ParseIntPipe) id: number, @User('id') userId: number) {
    return this.haiPapersService.getHaiPaperById(id, userId);
  }

  @Post(':id/bookmark')
  @ApiOperation({
    description: '휴먼과 논문 북마크를 표시/해제하는 API',
  })
  @UseInterceptors(TransactionInterceptor)
  toggleHaiPaperBookmark(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ) {
    return this.haiPapersService.toggleHaiPaperBookmark(id, userId, qr);
  }

  @Post(':id/reading-status')
  @ApiOperation({
    description: '휴먼과 논문 읽는 중 상태를 토글(시작/취소)하는 API',
  })
  @UseInterceptors(TransactionInterceptor)
  toggleReadingStatus(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ) {
    return this.haiPapersService.toggleReadingStatus(id, userId, qr);
  }

  @Post(':id/reading-status/complete')
  @ApiOperation({
    description: '휴먼과 논문 읽기 완료로 전환하는 API',
  })
  @UseInterceptors(TransactionInterceptor)
  completeReadingStatus(
    @Param('id', ParseIntPipe) id: number,
    @User('id') userId: number,
    @QueryRunner() qr: QR,
  ) {
    return this.haiPapersService.completeReading(id, userId, qr);
  }

  @Get(':id/similar')
  @IsPublic()
  @ApiOperation({
    description: 'HAI 논문 기준 유사 논문 추천 API(기본 논문 + HAI 논문 통합)',
  })
  getSimilarHaiPapers(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.haiPapersService.getSimilarHaiPapers(id, limit);
  }

  @Post()
  @ApiOperation({
    description: '휴먼과 논문 생성 API(관리자 권한)',
  })
  @Roles(RolesEnum.ADMIN)
  createPaper(@Body() dto: CreateHAIpaperDto) {
    return this.haiPapersService.createHaiPaper(dto);
  }

  @Patch(':id')
  @ApiOperation({
    description: 'id 기반 단일 휴먼과 논문을 수정하는 API(관리자 권한)',
  })
  @Roles(RolesEnum.ADMIN)
  updatePaper(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatHAIpaperDto,
  ) {
    return this.haiPapersService.updateHaiPaper(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    description: 'id 기반 단일 휴먼과 논문을 삭제하는 API(관리자 권한)',
  })
  @Roles(RolesEnum.ADMIN)
  deletePaper(@Param('id', ParseIntPipe) id: number) {
    return this.haiPapersService.deleteHaiPaper(id);
  }
}
