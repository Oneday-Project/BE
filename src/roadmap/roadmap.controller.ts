import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoadmapService } from './roadmap.service';
import { AnalyzeRoadmapDto } from './dto/analyze-roadmap.dto';

@Controller('roadmap')
@ApiBearerAuth()
export class RoadmapController {
    constructor(private readonly roadmapService: RoadmapService) {}

    @Post('analyze')
    @ApiOperation({ description: '설문 응답 기반 로드맵 분석 API' })
    analyzeRoadmap(@Body() dto: AnalyzeRoadmapDto) {
        return this.roadmapService.analyzeRoadmap(dto);
    }
}
