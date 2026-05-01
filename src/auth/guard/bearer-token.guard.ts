import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { UsersService } from "src/users/users.service";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "src/common/decorator/is-public.decorator";

@Injectable()
export class BearerTokenGuard implements CanActivate{
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly reflector: Reflector,
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean> {

        // 토큰 검증 전에 여기에서 reflectMetadata 기능을 사용해서
        // public route로 annotation을 달았는지 검증 한 다음에
        // 만약 public route라고 되어 있으면 바로 true 반환
        const isPublic = this.reflector.getAllAndOverride(
            IS_PUBLIC_KEY,
            [
                context.getHandler(),
                context.getClass(),
            ]
        )


        const req = context.switchToHttp().getRequest()

        if(isPublic){
            // req에 이게 public route라는 것을 달아줄 것임
            // 그래야 밑에서(AccessTokenGuard, RefreshTokenGuard 클래스) 또 검증을 안하니까 
            req.isRoutePublic = true;

            return true;
        }

        const rawToken = req.headers['authorization'];

        if(!rawToken){
            throw new UnauthorizedException('토큰이 없습니다!');
        }

        const token = this.authService.extractTokenFromHeader(rawToken);

        const result = await this.authService.verifyToken(token); // 검증 성공 시 페이로드 반환

        /**
         * request에 넣을 정보
         * 1) 사용자 정보 - user
         * 2) token - token
         * 3) tokenType - access | refresh
         * 이 정보를 가지고 나중에 검증을 해야될 경우가 생길 수 있기 때문
         */
        const user = await this.usersService.getUserByEmail(result.email);

        req.user = user;
        req.token = token;
        req.tokenType = result.type;

        return true;
    }
}

// access토큰과 refresh토큰을 따로 검증하고 싶을 때
// (BearerTokenGuard를 거친 뒤에 여기서 나온 tokenType을 보고 다시 검증)

// AccessTokenGaurd는 리소스 요청 시 access토큰을 갖고 요청해야 하는 과정에서 사용
// ex. post 생성/업데이트/삭제 작업 등
@Injectable()
export class AccessTokenGuard extends BearerTokenGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // AccessTokenGuard가 적용될 때마다 BearerTokenGuard 로직이 그대로 다 실행
        
        const req = context.switchToHttp().getRequest();

        // 이 코드 추가!!
        if(req.isRoutePublic){
            return true;
        }

        if(req.tokenType !== 'access'){
            throw new UnauthorizedException('Access Token이 아닙니다.');
        }

        return true;
    }
}

@Injectable()
export class RefreshTokenGuard extends BearerTokenGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); 
        
        const req = context.switchToHttp().getRequest();
        
        // 이 코드 추가!!
        if(req.isRoutePublic){
            return true;
        }

        if(req.tokenType !== 'refresh'){
            throw new UnauthorizedException('Refresh Token이 아닙니다.');
        }

        return true;
    }
}


// 이렇게 하면 route가 public일 때 그냥 모든 토큰 가드들을 pass하도록 작업 완료