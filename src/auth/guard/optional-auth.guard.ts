import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { UsersService } from 'src/users/users.service';

// 로그인 여부와 무관하게 접근 가능한(공개) 라우트에서, 로그인한 유저면 req.user를 채우고
// 토큰이 없거나 유효하지 않아도 절대 요청을 막지 않는(게스트로 통과) 가드
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const rawToken = req.headers['authorization'];

    if (!rawToken) {
      return true; // 토큰 없음 -> 게스트로 통과
    }

    try {
      const token = this.authService.extractTokenFromHeader(rawToken);
      const result = await this.authService.verifyToken(token);

      if (result.type !== 'access') {
        return true; // access 토큰이 아니면 게스트로 취급
      }

      req.user = await this.usersService.getUserByEmail(result.email);
    } catch {
      // 토큰이 잘못됐거나 만료됐어도 게스트로 통과(에러를 던지지 않음)
    }

    return true;
  }
}
