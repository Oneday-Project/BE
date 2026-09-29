import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SmuLoginDto {
    @ApiProperty({
        description: '학번',
        example: '202012345',
    })
    @IsNotEmpty()
    @IsString()
    @Matches(/^\d+$/, { message: '학번은 숫자만 입력해주세요.' })
    studentId!: string; // 학번

    @ApiProperty({
        description: '학교 포털(샘물) 비밀번호 — 저장하지 않고 인증에만 사용합니다',
        example: 'password',
    })
    @IsNotEmpty()
    @IsString()
    password!: string; // 학교 포털 비밀번호
}
