import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class RegisterUserDto {
    @IsNotEmpty()
    @IsString()
    username!: string; // 사용자 이름

    @IsNotEmpty()
    @IsString()
    nickname!: string; // 닉네임

    @IsNotEmpty()
    @IsString()
    @IsEmail()
    email!: string; // 이메일

    @IsNotEmpty()
    @IsString()
    password!: string; // 비밀번호
    
}