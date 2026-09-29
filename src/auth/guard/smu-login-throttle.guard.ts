import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

// 샘물 로그인은 "학번 + 학교 포털 비밀번호"를 받는다.
// 제한이 없으면 이 API로 학생들의 학교 비밀번호를 무작위로 대입해볼 수 있으므로,
// 같은 IP에서 짧은 시간에 여러 번 시도하는 것을 막는다.
//
// 서버 인스턴스 1대 기준(메모리에 기록)이다. 인스턴스를 여러 대로 늘리거나
// 다른 API에도 같은 제한이 필요해지면 @nestjs/throttler + Redis로 옮기면 된다.
const WINDOW_MS = 60_000; // 1분
const MAX_ATTEMPTS = 5; // 1분에 5회

@Injectable()
export class SmuLoginThrottleGuard implements CanActivate {
  // IP -> 최근 시도 시각 목록
  private readonly attempts = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip = this.resolveIp(req);
    const now = Date.now();

    // 이 IP의 기록 중 1분이 지난 것은 버린다
    const recent = (this.attempts.get(ip) ?? []).filter(
      (at) => now - at < WINDOW_MS,
    );

    if (recent.length >= MAX_ATTEMPTS) {
      throw new HttpException(
        '로그인 시도가 너무 많습니다. 1분 후에 다시 시도해주세요.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recent.push(now);
    this.attempts.set(ip, recent);

    // 오랫동안 쓰이지 않은 IP 기록을 정리한다(메모리가 계속 늘어나지 않게)
    this.cleanUp(now);

    return true;
  }

  // Railway처럼 프록시 뒤에 있으면 req.ip가 모든 요청에서 프록시 주소로 같게 나온다.
  // 그대로 쓰면 한 사람이 5번 시도한 순간 모든 사용자의 로그인이 막힌다.
  // 그래서 프록시가 붙여주는 X-Forwarded-For의 첫 주소(원래 클라이언트)를 먼저 본다.
  // 이 헤더는 위조할 수 있어서 완벽한 차단은 아니지만, 무작위 대입을 늦추는 용도로는 충분하다.
  private resolveIp(req: {
    headers?: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
  }) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;

    return (
      first?.split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'unknown'
    );
  }

  private cleanUp(now: number) {
    for (const [ip, times] of this.attempts) {
      if (times.every((at) => now - at >= WINDOW_MS)) {
        this.attempts.delete(ip);
      }
    }
  }
}
