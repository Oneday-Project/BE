import { Body, Controller, Post, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  registerUser(
    @Body() body: RegisterUserDto,
  ){
    return this.authService.registerWithEmail(body);
  }

  @Post('login')
  loginUser(
    @Body() body: LoginUserDto,
  ){
    return this.authService.loginWithEmail(body);
  }

  @Post('token/access') // access토큰 재발급
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

  @Post('token/access') // access토큰 재발급
  getRefreshToken(@Headers('authorization') rawToken: string) { 
    const bearerToken = this.authService.extractTokenFromHeader(rawToken); 
    const newToken = this.authService.rotateToken(bearerToken, true); // access토큰 재발급

    /**
     * 반환 형태
     * {accessToken: {token}}
     */
    return {
      refreshToken: newToken,
    }
  }
}