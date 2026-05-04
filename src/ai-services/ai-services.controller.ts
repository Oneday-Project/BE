import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AiServicesService } from './ai-services.service';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@Controller('ai-services')
@ApiBearerAuth()
export class AiServicesController {
  constructor(private readonly aiServicesService: AiServicesService) {}

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


}
