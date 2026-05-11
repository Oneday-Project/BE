import { IsString } from "class-validator";

export class CreateHaiPaperAiSummaryDTO {
    @IsString()
    whyRead!: string; // 내가 왜 읽어야 하는가. 중요도에 따라 답변 뉘앙스 달라짐

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