import { Body, Controller, Post, Headers, UseGuards, Patch } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { RefreshTokenGuard } from './guard/bearer-token.guard';
import { SmuLoginThrottleGuard } from './guard/smu-login-throttle.guard';
import { SmuLoginDto } from './dto/smu-login.dto';
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
    description: '이메일 로그인 API(샘물 로그인이 불가능할 때 쓰는 예비 수단)',
  })
  @IsPublic()
  loginUser(
    @Body() body: LoginUserDto,
  ){
    return this.authService.loginWithEmail(body);
  }

  @Post('smu/login')
  @ApiOperation({
    description:
      '샘물(학교 계정) 로그인 API — 기본 로그인 수단. ' +
      '학번과 학교 포털 비밀번호로 인증하며, 처음 로그인하면 자동으로 가입된다(닉네임 자동 생성). ' +
      '비밀번호는 저장하지 않는다. 응답은 이메일 로그인과 동일(accessToken, refreshToken)',
  })
  @IsPublic()
  @UseGuards(SmuLoginThrottleGuard)
  loginWithSmu(
    @Body() body: SmuLoginDto,
  ){
    return this.authService.loginWithSmu(body);
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

  // @Patch('password')
  // @ApiOperation({ description: '비밀번호 변경 API' })
  // changePassword(
  //     @User('id') id: number,
  //     @Body() dto: ChangePasswordDto,
  // ) {
  //     return this.authService.changePassword(id, dto);
  // }
}