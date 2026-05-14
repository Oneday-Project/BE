import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
    @ApiProperty({
        description: '닉네임',
        example: 'u1', 
    })
    @IsOptional()
    @IsString()
    nickname?: string; // 닉네임
}
