import { Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AiServicesService } from './ai-services.service';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiQuery } from '@nestjs/swagger';
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
    description: 'arxivId 기반 단일 논문 AI 요약을 생성하는 API(관리자 권한)',
  })
  @Roles(RolesEnum.ADMIN)
  generatePaperAiSummary(
    @Param('arxivId') arxivId: string,
    //@Body() dto: CreatePaperAiSummaryDTO,
  ){
    //return this.aiServicesService.createPaperAiSummary(arxivId, dto);
    return this.aiServicesService.generatePaperAiSummary(arxivId);
  }

  // 아래 :arxivId 라우트보다 반드시 먼저 선언해야 한다(순서가 바뀌면 'batch'가 arxivId로 잡힌다)
  @Patch('papers/batch')
  @ApiOperation({
    description:
      '모든 논문의 AI 요약을 다시 생성해 갱신하는 API(관리자 권한). ' +
      '요약이 없던 논문은 새로 생성한다. 논문 수만큼 GPT를 호출하므로 비용에 주의',
  })
  @ApiQuery({
    name: 'batchSize',
    required: false,
    example: 20,
    description: '한 번에 동시 처리할 논문 수(미입력 시 기본값 적용)',
  })
  @Roles(RolesEnum.ADMIN)
  regenerateAllPaperAiSummaries(
    @Query('batchSize', new ParseIntPipe({ optional: true })) batchSize?: number,
  ){
    return this.aiServicesService.regenerateAllPaperAiSummaries(batchSize);
  }

  @Patch('papers/:arxivId')
  @ApiOperation({
    description:
      'arxivId 기반 단일 논문 AI 요약을 다시 생성해 갱신하는 API(관리자 권한). 요약이 없으면 새로 생성한다',
  })
  @Roles(RolesEnum.ADMIN)
  regeneratePaperAiSummary(
    @Param('arxivId') arxivId: string,
  ){
    return this.aiServicesService.regeneratePaperAiSummary(arxivId);
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

  // 아래 :id 라우트들보다 반드시 먼저 선언해야 한다.
  // 순서가 바뀌면 'batch'가 :id로 잡혀 ParseIntPipe에서 400이 난다.
  @Post('hai-papers/batch')
  @ApiOperation({
    description: 'AI 요약이 없는 모든 휴먼과 논문에 대해 배치 단위로 AI 요약을 생성하는 API(관리자 권한)',
  })
  @ApiQuery({
    name: 'batchSize',
    required: false,
    example: 20,
    description: '한 번에 동시 처리할 논문 수(미입력 시 기본값 적용)',
  })
  @Roles(RolesEnum.ADMIN)
  generateAllHaiPaperAiSummaries(
    @Query('batchSize', new ParseIntPipe({ optional: true })) batchSize?: number,
  ){
    return this.aiServicesService.generateAllHaiPaperAiSummaries(batchSize);
  }

  @Post('hai-papers/batch/embedding')
  @ApiOperation({
    description: '임베딩이 없는 모든 휴먼과 논문에 대해 배치 단위로 임베딩 벡터를 생성하는 API(관리자 권한)',
  })
  @ApiQuery({
    name: 'batchSize',
    required: false,
    example: 20,
    description: '한 번에 동시 처리할 논문 수(미입력 시 기본값 적용)',
  })
  @Roles(RolesEnum.ADMIN)
  generateAllHaiPaperEmbeddings(
    @Query('batchSize', new ParseIntPipe({ optional: true })) batchSize?: number,
  ){
    return this.aiServicesService.generateAllHaiPaperEmbeddings(batchSize);
  }

  @Post('hai-papers/:id')
  @ApiOperation({
    description: 'id 기반 휴먼과 단일 논문 AI 요약을 생성하는 API(관리자 권한)',
  })
  @Roles(RolesEnum.ADMIN)
  createHaiPaperAiSummary(
    @Param('id', ParseIntPipe) id: number,
  ){
    return this.aiServicesService.createHaiPaperAiSummary(id);
  }

  // 아래 :id 라우트보다 반드시 먼저 선언해야 한다(순서가 바뀌면 'batch'가 :id로 잡혀 400이 난다)
  @Patch('hai-papers/batch')
  @ApiOperation({
    description:
      '모든 휴먼과 논문의 AI 요약을 다시 생성해 갱신하는 API(관리자 권한). ' +
      '요약이 없던 논문은 새로 생성한다. 논문 수만큼 GPT를 호출하므로 비용에 주의',
  })
  @ApiQuery({
    name: 'batchSize',
    required: false,
    example: 20,
    description: '한 번에 동시 처리할 논문 수(미입력 시 기본값 적용)',
  })
  @Roles(RolesEnum.ADMIN)
  regenerateAllHaiPaperAiSummaries(
    @Query('batchSize', new ParseIntPipe({ optional: true })) batchSize?: number,
  ){
    return this.aiServicesService.regenerateAllHaiPaperAiSummaries(batchSize);
  }

  @Patch('hai-papers/:id')
  @ApiOperation({
    description:
      'id 기반 휴먼과 단일 논문 AI 요약을 다시 생성해 갱신하는 API(관리자 권한). 요약이 없으면 새로 생성한다',
  })
  @Roles(RolesEnum.ADMIN)
  regenerateHaiPaperAiSummary(
    @Param('id', ParseIntPipe) id: number,
  ){
    return this.aiServicesService.regenerateHaiPaperAiSummary(id);
  }

  @Post('papers/batch/embedding')
  @ApiOperation({
    description: '임베딩이 없는 모든 논문에 대해 배치 단위로 임베딩 벡터를 생성하는 API(관리자 권한)',
  })
  @Roles(RolesEnum.ADMIN)
  generateAllPaperEmbeddings(
    @Query('batchSize', new ParseIntPipe({ optional: true })) batchSize?: number,
  ){
    return this.aiServicesService.generateAllPaperEmbeddings(batchSize);
  }

  @Post('papers/:arxivId/embedding')
  @ApiOperation({ description: '단일 논문에 GPT 임베딩 벡터 할당 API(관리자 권한)' })
  @ApiExcludeEndpoint()
  @Roles(RolesEnum.ADMIN)
  saveTestEmbedding(@Param('arxivId') arxivId: string) {
      return this.aiServicesService.generatePaperEmbedding(arxivId);
  }

  @Post('hai-papers/:id/embedding')
  @ApiOperation({ description: '단일 휴먼과 논문에 GPT 임베딩 벡터 할당 API(관리자 권한)' })
  @ApiExcludeEndpoint()
  @Roles(RolesEnum.ADMIN)
  generateHaiPaperEmbedding(@Param('id', ParseIntPipe) id: number) {
      return this.aiServicesService.generateHaiPaperEmbedding(id);
  }

  
}
