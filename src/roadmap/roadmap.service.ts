import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoadmapTask, RoadmapStage } from './entities/roadmap-task.entity';
import {
    AnalyzeRoadmapDto,
    Q9_NONE,
    Q10_NONE,
    GPA_BANDS,
} from './dto/analyze-roadmap.dto';

@Injectable()
export class RoadmapService {
    constructor(
        @InjectRepository(RoadmapTask)
        private readonly roadmapTaskRepository: Repository<RoadmapTask>,
    ) {}

    // GPA 구간을 점수로 환산 (구간 인덱스 * 2.5 -> 0 / 2.5 / 5 / 7.5 / 10)
    private gpaScore(gpaBand: string): number {
        return GPA_BANDS.indexOf(gpaBand as (typeof GPA_BANDS)[number]) * 2.5;
    }

    private calculateScore(dto: AnalyzeRoadmapDto): number {
        const q3to8 = dto.q3 + dto.q4 + dto.q5 + dto.q6 + dto.q7 + dto.q8;
        // '없음'은 점수에 포함하지 않음 (선택 시 0점)
        const q9Count = dto.q9.filter((item) => item !== Q9_NONE).length;
        const q10Count = dto.q10.filter((item) => item !== Q10_NONE).length;
        const q9Score = Math.min(q9Count * 2.5, 10);
        const q10Score = Math.min(q10Count * 2.5, 10);
        return q3to8 + q9Score + q10Score + dto.q11 + this.gpaScore(dto.gpaBand);
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
        // 하위 2개 구간('2.5 미만', '2.5 이상 ~ 3.0 미만')이면 학점 개선 필요
        if (this.gpaScore(dto.gpaBand) <= 2.5) weaknesses.push('학점 개선 필요');
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
