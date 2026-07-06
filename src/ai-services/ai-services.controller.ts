import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { AiServicesService } from './ai-services.service';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CreateHaiPaperAiSummaryDTO } from './dto/create-hai-paper-ai-summary.dto';
import { Roles } from 'src/auth/decorator/roles.decorator';
import { RolesEnum } from 'src/users/const/roles.const';

@Controller('ai-services')
@ApiBearerAuth()
export class AiServicesController {
  constructor(private readonly aiServicesService: AiServicesService) {}

  // 기본(arxiv + ss)논문 AI 요약 파트
  @Get('papers')
  @ApiOperation({
    description: '모든 논문 AI 요약을 가져오는 API', 
  })
  getAllPaperAiSummary(){
    return this.aiServicesService.getAllPaperAiSummary();
  }

  @Get('papers/:arxivId')
  @ApiOperation({
    description: 'arxivId 기반 단일 논문 AI 요약을 가져오는 API', 
  })
  getPaperAiSummary(
    @Param('arxivId') arxivId: string
  ){
    return this.aiServicesService.getPaperAiSummaryByArxivId(arxivId); 
  }

  @Post('papers/batch')
  @ApiOperation({
    description: 'AI 요약이 없는 모든 논문에 대해 배치 단위로 AI 요약을 생성하는 API(관리자 권한)',
  })
  @ApiQuery({
    name: 'batchSize',
    required: false,
    example: 20,
    description: '한 번에 동시 처리할 논문 수(미입력 시 기본값 적용)',
  })
  @Roles(RolesEnum.ADMIN)
  generateAllPaperAiSummaries(
    @Query('batchSize', new ParseIntPipe({ optional: true })) batchSize?: number,
  ){
    return this.aiServicesService.generateAllPaperAiSummaries(batchSize);
  }

  @Post('papers/:arxivId')
  @ApiOperation({
    description: 'arxivId 기반 단일 논문 AI 요약을 생성하는 API',
  })
  generatePaperAiSummary(
    @Param('arxivId') arxivId: string,
    //@Body() dto: CreatePaperAiSummaryDTO,
  ){
    //return this.aiServicesService.createPaperAiSummary(arxivId, dto);
    return this.aiServicesService.generatePaperAiSummary(arxivId);
  }


  // 휴먼과 논문 AI 요약 파트
  @Get('hai-papers')
  @ApiOperation({
    description: '모든 휴먼과 논문 AI 요약을 가져오는 API', 
  })
  getAllHaiPaperAiSummary(){
    return this.aiServicesService.getAllHaiPaperAiSummary();
  }

  @Get('hai-papers/:id')
  @ApiOperation({
    description: 'ID 기반 휴먼과 단일 논문 AI 요약을 가져오는 API', 
  })
  getHaiPaperAiSummary(
    @Param('id', ParseIntPipe) id: number,
  ){
    return this.aiServicesService.getHaiPaperAiSummaryById(id);
  }

  @Post('hai-papers/:id')
  @ApiOperation({
    description: 'id 기반 휴먼과 단일 논문 AI 요약을 생성하는 API', 
  })
  createHaiPaperAiSummary(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateHaiPaperAiSummaryDTO, 
  ){
    return this.aiServicesService.createHaiPaperAiSummary(id, dto);
  }

  @Post('papers/:arxivId/embedding')
  @ApiOperation({ description: '단일 논문에 GPT 임베딩 벡터 할당 API' })
  @ApiExcludeEndpoint()
  saveTestEmbedding(@Param('arxivId') arxivId: string) {
      return this.aiServicesService.generatePaperEmbedding(arxivId);
  }


}
