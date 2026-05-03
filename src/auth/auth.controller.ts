import { Body, Controller, Post, Headers, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { RefreshTokenGuard } from './guard/bearer-token.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @IsPublic()
  registerUser(
    @Body() body: RegisterUserDto,
  ){
    return this.authService.registerWithEmail(body);
  }

  @Post('login')
  @IsPublic()
  loginUser(
    @Body() body: LoginUserDto,
  ){
    return this.authService.loginWithEmail(body);
  }

  @Post('token/access') // access토큰 재발급
  @IsPublic()
  @UseGuards(RefreshTokenGuard) 
  getAccessToken(@Headers('authorization') rawToken: string) { 
    const bearerToken = this.authService.extractTokenFromHeader(rawToken); 
    const newToken = this.authService.rotateToken(bearerToken, false); // access토큰 재발급

    /**
     * 반환 형태
     * {accessToken: {token}}
     */
    return {
      accessToken: newToken,
    }
  }

  @Post('token/refresh') // refresh토큰 재발급
  @IsPublic()
  @UseGuards(RefreshTokenGuard) 
  getRefreshToken(@Headers('authorization') rawToken: string) { 
    const bearerToken = this.authService.extractTokenFromHeader(rawToken); 
    const newToken = this.authService.rotateToken(bearerToken, true); // refresh토큰 재발급

    /**
     * 반환 형태
     * {refreshToken: {token}}
     */
    return {
      refreshToken: newToken,
    }
  }
}