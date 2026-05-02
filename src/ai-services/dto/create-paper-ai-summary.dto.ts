import { IsString } from "class-validator";

export class CreatePaperAiSummaryDTO {
    @IsString()
    aiSummary!: string; // AI 종합 요약

    @IsString()
    abstract_kor!: string;

    @IsString()
    what!: string; // 이 논문은 무엇을 연구했는가?

    @IsString()
    how!: string; // 어떤 방법을 사용했는가?

    @IsString()
    so_what!: string; // 결과/의의는?

    @IsString()
    model!: string; // 사용한 AI 모델 버전
}