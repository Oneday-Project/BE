import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { AiServicesService } from './ai-services.service';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateHaiPaperAiSummaryDTO } from './dto/create-hai-paper-ai-summary.dto';

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

  @Post('papers/:arxivId')
  @ApiOperation({
    description: 'arxivId 기반 단일 논문 AI 요약을 생성하는 API', 
  })
  createPaperAiSummary(
    @Param('arxivId') arxivId: string,
    @Body() dto: CreatePaperAiSummaryDTO,
  ){
    return this.aiServicesService.createPaperAiSummary(arxivId, dto);
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


}
