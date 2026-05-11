import { IsString } from "class-validator";

export class CreateHaiPaperAiSummaryDTO {
    @IsString()
    abstractKor!: string; // 초록 한국어 번역

    @IsString()
    what!: string; // 무엇을 연구 했는가(초록보다 구체적으로) 

    @IsString()
    how!: string; // 어떤 방식으로 했는가(초록보다 구체적으로)

    @IsString()
    impact!: string; // 결과 + 미래 영향

    @IsString()
    model!: string; // 사용한 AI 모델 버전
}