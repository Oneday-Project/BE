import { BaseModel } from 'src/common/entities/base.entity';
import {
    Column,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from 'src/users/entities/users.entity';
import { AnalyzeRoadmapDto } from '../dto/analyze-roadmap.dto';
import { RoadmapStage, RoadmapTask } from './roadmap-task.entity';

// 메인페이지 오각형(레이더) 그래프의 5개 축 점수 (각 0~10)
export interface RoadmapRadar {
    interest: number; // 관심·이해 (Q3, Q4)
    experience: number; // 연구·프로젝트 경험 (Q5, Q6)
    paper: number; // 논문 역량 (Q7, Q8)
    preparation: number; // 준비·대외활동 (Q9, Q10)
    academic: number; // 학업 기반 (Q11, GPA)
}

// 설문 분석 결과 (analyzeRoadmap이 만들어내는 값)
export interface RoadmapResult {
    overview: {
        totalScore: number;
        stage: RoadmapStage;
        interestFields: string[]; // 선택한 관심 분야 태그 (선택한 것만)
        comment: string; // GPT가 생성한 종합 코멘트
    };
    radar: RoadmapRadar;
    strengths: string[];
    weaknesses: string[];
    roadmap: {
        major: RoadmapTask[];
        paper: RoadmapTask[];
        growth: RoadmapTask[];
    };
}

// 한 시점의 로드맵 스냅샷 (응답 + 분석 결과)
export interface RoadmapSnapshot {
    answers: AnalyzeRoadmapDto;
    result: RoadmapResult;
    createdAt: string; // ISO 8601
}

// 사용자당 1행. 최초 로드맵 1개와 최근 로드맵 1개를 함께 보관한다.
@Entity('user_roadmaps')
export class UserRoadmap extends BaseModel {
    @PrimaryGeneratedColumn()
    id!: number;

    // 사용자당 하나만 존재 (unique)
    @Column({ unique: true })
    userId!: number;

    @OneToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user!: User;

    // 최초 로드맵 (생성 시 1회 저장, 이후 변경되지 않음)
    @Column({ type: 'jsonb' })
    initial!: RoadmapSnapshot;

    // 최근 로드맵 (수정할 때마다 갱신)
    @Column({ type: 'jsonb' })
    latest!: RoadmapSnapshot;
}
