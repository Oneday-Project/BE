import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class RegisterUserDto {
    @ApiProperty({
        description: '사용자 이름',
        example: 'admin1', 
    })
    @IsNotEmpty()
    @IsString()
    username!: string; // 사용자 이름

    @ApiProperty({
        description: '닉네임',
        example: 'a1', 
    })
    @IsNotEmpty()
    @IsString()
    nickname!: string; // 닉네임

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
        example: 'admin@naver.com', 
    })
    @IsNotEmpty()
    @IsString()
    password!: string; // 비밀번호
    
}