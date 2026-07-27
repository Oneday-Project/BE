import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User as UserModel } from '../entities/users.entity';

// OptionalAuthGuard와 함께 사용 — 로그인 안 했으면 에러 대신 undefined를 반환한다
export const OptionalUser = createParamDecorator(
  (data: keyof UserModel | undefined, context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    const user = req.user as UserModel | undefined;

    if (!user) {
      return undefined;
    }

    if (data) {
      return user[data];
    }

    return user;
  },
);
