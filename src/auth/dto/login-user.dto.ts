import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class LoginUserDto {
    @IsNotEmpty()
    @IsString()
    @IsEmail()
    email!: string; // 이메일

    @IsNotEmpty()
    @IsString()
    password!: string; // 비밀번호
    
}