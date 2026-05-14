import { Body, Controller, Post, Headers, UseGuards, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { RefreshTokenGuard } from './guard/bearer-token.guard';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { User } from 'src/users/decorator/user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
@ApiBearerAuth()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({
    description: '회원가입 API',
  })
  @IsPublic()
  registerUser(
    @Body() body: RegisterUserDto,
  ){
    return this.authService.registerWithEmail(body);
  }

  @Post('login')
  @ApiOperation({
    description: '로그인 API',
  })
  @IsPublic()
  loginUser(
    @Body() body: LoginUserDto,
  ){
    return this.authService.loginWithEmail(body);
  }

  @Post('token/access') // access토큰 재발급
  @ApiOperation({
    description: 'access토큰 재발급 API',
  })
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
  @ApiOperation({
    description: 'refresh토큰 재발급 API',
  })
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

  @Patch('password')
  @ApiOperation({ description: '비밀번호 변경 API' })
  changePassword(
      @User('id') id: number,
      @Body() dto: ChangePasswordDto,
  ) {
      return this.authService.changePassword(id, dto);
  }
}