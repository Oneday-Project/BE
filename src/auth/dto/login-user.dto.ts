import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginUserDto {
    @ApiProperty({
        description: '이메일',
        example: 'admin@naver.com', 
    })
    @IsNotEmpty()
    @IsString()
    @IsEmail()
    email!: string; // 이메일

    @ApiProperty({
        description: '비밀번호',
        example: '123123', 
    })
    @IsNotEmpty()
    @IsString()
    password!: string; // 비밀번호
    
}