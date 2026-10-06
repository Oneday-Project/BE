import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, Min } from "class-validator";

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

    @ApiPropertyOptional({
        description: '정렬 기준(예: ["id_DESC"], ["likeCount_DESC"]). 비우면 각 API의 기본 정렬을 따른다.',
        example: ['id_DESC'],
        type: [String],
    })
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
    // 하한만 둔다. 하한이 없으면 음수 take가 LIMIT -1이 되어 500이 난다.
    // 상한은 두지 않기로 했다(화면에서 한 번에 많이 보여줘야 하는 경우가 있어서).
    @IsInt()
    @Min(1)
    @IsOptional()
    take: number = 12;
}