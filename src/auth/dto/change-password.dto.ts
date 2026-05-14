import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// 비밀번호 변경 DTO
export class ChangePasswordDto {
    @ApiProperty(
        { description: '현재 비밀번호', 
            example: '123123' 
        })
    @IsNotEmpty()
    @IsString()
    currentPassword!: string;

    @ApiProperty({ 
        description: '새 비밀번호', 
        example: 'abcabc' 
    })
    @IsNotEmpty()
    @IsString()
    newPassword!: string;
}