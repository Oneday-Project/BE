import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from 'src/common/const/env.const';

// 학교 인증에 성공했을 때 받는 정보
// (smu-nity/sangmyung-univ-auth 응답 스펙: username, name, email, department, secondDepartment)
export interface SmuProfile {
  studentId: string; // 학번 (응답의 username)
  name: string; // 실명
  email: string | null; // 학교 이메일 (없을 수 있음)
  department: string | null; // 전공
  secondDepartment: string | null; // 복수전공
}

const SMU_AUTH_DEFAULT_URL = 'https://smunity.co.kr/api/v1/auth';

// 학교 서버가 느릴 때 요청이 무한정 붙잡혀 있지 않도록 끊는 기준(ms)
const SMU_AUTH_TIMEOUT_MS = 8000;

// 상명대 포털 계정(샘물) 인증을 담당하는 클라이언트.
//
// 이 API는 학번/비밀번호를 받아 학교 포털 SSO에 대신 로그인하는 비공식 서비스다(OAuth가 아니다).
// 그래서 두 가지를 반드시 지킨다.
//   1) 비밀번호는 저장하지 않는다 - 이 클래스 밖으로 나가지 않고, 인증 후 그대로 버린다.
//   2) 비밀번호는 로그에 남기지 않는다 - 실패해도 학번조차 남기지 않고 상태 코드만 기록한다.
//
// 외부 서비스 호출을 이 한 곳에 모아 두었으므로, 나중에 학교 SSO를 직접 구현하는 방식으로
// 바꿀 때도 이 파일만 교체하면 된다.
@Injectable()
export class SmuAuthClient {
  private readonly logger = new Logger(SmuAuthClient.name);

  constructor(private readonly configService: ConfigService) {}

  async authenticate(studentId: string, password: string): Promise<SmuProfile> {
    const url =
      this.configService.get<string>(envVariableKeys.smuAuthUrl) ?? SMU_AUTH_DEFAULT_URL;

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: studentId, password }),
        signal: AbortSignal.timeout(SMU_AUTH_TIMEOUT_MS),
      });
    } catch (e) {
      // 네트워크 오류·타임아웃 - 학생이 뭘 잘못한 게 아니므로 401이 아니라 503으로 알린다.
      this.logger.warn(`샘물 인증 서버 연결 실패: ${(e as Error).name}`);
      throw new ServiceUnavailableException(
        '학교 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도하거나 이메일 로그인을 이용해주세요.',
      );
    }

    if (response.status === 401) {
      throw new UnauthorizedException('학번 또는 비밀번호가 틀렸습니다.');
    }

    if (!response.ok) {
      this.logger.warn(`샘물 인증 서버 응답 오류: ${response.status}`);
      throw new ServiceUnavailableException(
        '학교 인증 서버에 문제가 있습니다. 잠시 후 다시 시도하거나 이메일 로그인을 이용해주세요.',
      );
    }

    const data = (await response.json()) as {
      username?: string;
      name?: string;
      email?: string | null;
      department?: string | null;
      secondDepartment?: string | null;
    };

    // 학번과 이름이 없으면 사용자를 만들 수 없다(응답 형식이 바뀐 경우).
    if (!data.username || !data.name) {
      this.logger.warn('샘물 인증 응답에 학번 또는 이름이 없습니다.');
      throw new ServiceUnavailableException(
        '학교 인증 응답을 처리할 수 없습니다. 관리자에게 문의해주세요.',
      );
    }

    return {
      studentId: data.username,
      name: data.name,
      email: data.email ?? null,
      department: data.department ?? null,
      secondDepartment: data.secondDepartment ?? null,
    };
  }
}
