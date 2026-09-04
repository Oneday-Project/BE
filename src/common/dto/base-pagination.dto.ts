import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class BasePaginationDto {
    @ApiPropertyOptional({
        description: '페이지네이션 페이지',
        example: 1, 
    })
    @IsInt()
    @Min(1)
    @IsOptional()
    page?: number;

    @ApiPropertyOptional({
        description: '페이지네이션 커서',
    })
    @IsString()
    @IsOptional()
    // 들어가는 데이터 예시
    // id_52, likeCount_20
    cursor?: string;

    @IsArray()
    @IsString({
        each: true,
    })
    @IsOptional()
    @Transform(({ value }) => Array.isArray(value) ? value : [value])
    // 들어가는 데이터 예시
    // [id_DESC, likeCount_DESC]
    order: string[] = [];

    @ApiPropertyOptional({
        description: '가져올 데이터 개수',
        example: 5, 
    })
    // 상한이 없으면 비회원도 ?take=100000 한 번으로 전체를 통째로 긁어갈 수 있고
    // (논문 목록은 공개 API다) 논문이 쌓일수록 서버 부하가 그대로 커진다.
    // 하한이 없으면 음수 take가 LIMIT -1이 되어 500이 난다.
    // 상한 100은 마이페이지 라이브러리 조회(GetLibraryDto)와 같은 기준으로 맞췄다.
    @IsInt()
    @Min(1)
    @Max(100)
    @IsOptional()
    take: number = 12;
}