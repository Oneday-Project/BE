import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoadmapTask, RoadmapStage } from './entities/roadmap-task.entity';
import { AnalyzeRoadmapDto } from './dto/analyze-roadmap.dto';

@Injectable()
export class RoadmapService {
    constructor(
        @InjectRepository(RoadmapTask)
        private readonly roadmapTaskRepository: Repository<RoadmapTask>,
    ) {}

    private calculateScore(dto: AnalyzeRoadmapDto): number {
        const q3to8 = dto.q3 + dto.q4 + dto.q5 + dto.q6 + dto.q7 + dto.q8;
        const q9Score = Math.min(dto.q9.length * 2.5, 10);
        const q10Score = Math.min(dto.q10.length * 2.5, 10);
        return q3to8 + q9Score + q10Score + dto.q11 + dto.q12;
    }

    private determineStage(totalScore: number): RoadmapStage {
        if (totalScore < 40) return 'foundation';
        if (totalScore < 70) return 'exploration';
        return 'specialization';
    }

    private determineStrengths(dto: AnalyzeRoadmapDto): string[] {
        const strengths: string[] = [];
        if (dto.interestFields.length >= 2) strengths.push('관심 분야 명확함');
        if (dto.q5 >= 7.5) strengths.push('프로젝트 경험 보유');
        if (dto.q7 >= 5) strengths.push('연구 활동 경험 있음');
        return strengths;
    }

    private determineWeaknesses(dto: AnalyzeRoadmapDto): string[] {
        const weaknesses: string[] = [];
        if (dto.q5 <= 2.5) weaknesses.push('프로젝트 경험 부족');
        if (dto.q7 <= 2.5) weaknesses.push('연구 경험 부족');
        if (dto.gpaBand?.includes('2.')) weaknesses.push('학점 개선 필요');
        return weaknesses;
    }

    async analyzeRoadmap(dto: AnalyzeRoadmapDto) {
        const totalScore = this.calculateScore(dto);
        const stage = this.determineStage(totalScore);
        const strengths = this.determineStrengths(dto);
        const weaknesses = this.determineWeaknesses(dto);

        const tasks = await this.roadmapTaskRepository.find({
            where: { stage },
            order: { priority: 'ASC' },
        });

        const roadmap = {
            major: tasks.filter((t) => t.category === 'major'),
            paper: tasks.filter((t) => t.category === 'paper'),
            growth: tasks.filter((t) => t.category === 'growth'),
        };

        const interestLabel = dto.interestFields.join(', ');
        const summary = `현재 점수 ${totalScore}점, 단계: ${stage}. 관심 분야 ${interestLabel} 기준 맞춤 로드맵입니다.`;

        return {
            overview: {
                totalScore,
                stage,
                summary,
            },
            strengths,
            weaknesses,
            roadmap,
        };
    }
}
