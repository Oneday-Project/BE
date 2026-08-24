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

// papers 모듈 조회 결과를 그대로 사용한다 (관심 분야 태그 매칭 + 안읽음 + 영향력지수 1위).
// papers 모듈 자체의 타입을 import하지 않고 로드맵에서 쓰는 필드만 별도로 선언해 모듈 간 의존 방향을 유지한다.
export interface RoadmapRecommendedPaper {
    arxivId: string;
    title: string;
    abstract: string;
    publishedDate: string;
    citationCount: number;
    influenceScore: number;
    pdfUrl: string;
    journal?: string;
    researchFields: string[]; // 태그 문자열 배열
    authors: string[]; // 저자명 배열
    starTier?: number;
    bookmarkCount: number;
    isBookmark?: boolean; // 로그인 상태일 때만 포함
    readingStatus?: string; // 로그인 상태일 때만 포함
    // 카드 설명 텍스트는 cardSummary(80~100자, "~논문"으로 끝나는 카드 전용 요약)를 우선 사용한다.
    // 아직 AI 요약이 생성되지 않은 논문이면 aiSummary 자체가 undefined (이 경우 abstract로 대체)
    aiSummary?: {
        cardSummary: string; // 논문 카드에 표시할 짧은 요약 - 이 화면에서 쓸 필드
        whyRead: string;
        abstractKor: string;
        what: string;
        how: string;
        impact: string;
    };
}

// 논문 로드맵 섹션 - 관심 분야(태그) 하나당 추천 논문 1편
export interface RoadmapPaperRecommendation {
    tag: string; // 추천 기준이 된 관심 분야 태그 (예: 'SML')
    paper: RoadmapRecommendedPaper | null; // 조건에 맞는(안읽은) 논문이 없으면 null
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
    // 관심 분야별 핵심 논문 추천 (papers 모듈 재사용, 영향력지수 1위 · 안읽은 논문 우선)
    paperRoadmap: RoadmapPaperRecommendation[];
    growthGuide: {
        paperFrequency: string; // 현재 논문 읽기 빈도 (Q7 답변 기반, 예: '월 1~3회')
        externalActivity: string; // 현재 대외 경험 (Q9+Q10 선택 개수 기반, 예: '3~5회')
        tips: string[]; // GPT가 생성한 성장 가이드 제안 (정확히 2개)
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
