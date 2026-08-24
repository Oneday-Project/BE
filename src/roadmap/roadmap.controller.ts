import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoadmapService } from './roadmap.service';
import { AnalyzeRoadmapDto } from './dto/analyze-roadmap.dto';
import { User } from 'src/users/decorator/user.decorator';
import { OptionalUser } from 'src/users/decorator/optional-user.decorator';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { OptionalAuthGuard } from 'src/auth/guard/optional-auth.guard';

@Controller('roadmap')
@ApiBearerAuth()
export class RoadmapController {
    constructor(private readonly roadmapService: RoadmapService) {}

    @Post('analyze')
    @ApiOperation({
        description:
            '설문 응답 기반 로드맵 분석 (저장하지 않는 미리보기, 비회원도 호출 가능). ' +
            '로그인 상태로 호출하면 논문 로드맵에서 이미 읽은 논문은 제외한다.',
    })
    @IsPublic()
    @UseGuards(OptionalAuthGuard)
    analyzeRoadmap(
        @Body() dto: AnalyzeRoadmapDto,
        @OptionalUser('id') userId?: number,
    ) {
        return this.roadmapService.analyzeRoadmap(dto, userId);
    }

    @Get('me')
    @ApiOperation({
        description:
            '내 로드맵 조회 (메인페이지 오각형 그래프용, 최초+최근 스냅샷 반환)',
    })
    getMyRoadmap(@User('id') userId: number) {
        return this.roadmapService.getMyRoadmap(userId);
    }

    @Get('major-courses')
    @ApiOperation({
        description:
            '결과 페이지 전공 로드맵 조회 (전공과목 DB 실시간 조회, 학년·학기별 그룹핑, 관심분야 매칭 과목 강조)',
    })
    getMajorRoadmap(@User('id') userId: number) {
        return this.roadmapService.getMajorRoadmap(userId);
    }

    @Post()
    @ApiOperation({
        description: '최초 로드맵 생성 및 저장 (이미 있으면 409)',
    })
    createRoadmap(
        @User('id') userId: number,
        @Body() dto: AnalyzeRoadmapDto,
    ) {
        return this.roadmapService.createRoadmap(userId, dto);
    }

    @Patch()
    @ApiOperation({
        description: '최근 로드맵 수정 (없으면 404, 최초 로드맵은 보존)',
    })
    updateRoadmap(
        @User('id') userId: number,
        @Body() dto: AnalyzeRoadmapDto,
    ) {
        return this.roadmapService.updateRoadmap(userId, dto);
    }
}
