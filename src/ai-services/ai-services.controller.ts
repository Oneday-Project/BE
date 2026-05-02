import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AiServicesService } from './ai-services.service';
import { CreatePaperAiSummaryDTO } from './dto/create-paper-ai-summary.dto';

@Controller('ai-services')
export class AiServicesController {
  constructor(private readonly aiServicesService: AiServicesService) {}

  @Get('papers')
  getAllPaperAiSummary(){
    return this.aiServicesService.getAllPaperAiSummary();
  }

  @Get('papers/:arxivId')
  getPaperAiSummary(
    @Param('arxivId') arxivId: string
  ){
    return this.aiServicesService.getPaperAiSummaryByArxivId(arxivId);
  }

  @Post('papers/:arxivId')
  createPaperAiSummary(
    @Param('arxivId') arxivId: string,
    @Body() dto: CreatePaperAiSummaryDTO,
  ){
    return this.aiServicesService.createPaperAiSummary(arxivId, dto);
  }


}
