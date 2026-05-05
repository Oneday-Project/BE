import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorator/roles.decorator";

@Injectable()
export class RBACGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
    ){}    


    async canActivate(context: ExecutionContext): Promise<boolean> {
        /**
         * Roles annotation에 대한 metadata를 가져와야 한다.
         * (이걸 가져와야 현재 로그인된 사용자가 특정 함수의 실행 관한 유무를 알 수 있음)
         * 
         * Reflector 기능을 사용해서 이것을 확인 할 것임
         * Reflector 
         * - NestJS의 IOC 컨테이너에서 자동으로 주입 받을 수 있음
         * - getAllAndOverride()라는 기능이 있음
         *   -> Roles 데코레이터 만들 때 ROLES_KEY를 만들었는데
         *      현재 실행되는 함수에서 이 키에 해당되는 annotation에 대한 정보를 다 가져옴
         *      그 중에서 가장 가까운 annotation을 가져와서 값들을 override 함
         *      ex. 만약 @Roles(RolesEnum.USER)를 @Controller('posts')바로 아래에도 작성했다면
         *          @Roles()는 메서드에 붙어있는 annotation과 클래스에 붙어있는 annotation, 이 두가지를 고려할 수 있음
         *          -> 이때, 현재 실행하고 있는 함수에서 가장 가까이에 붙어있는 annotation은 메서드에 붙어있는 annotation
         *             (이것을 override 함)
         */

        const requireRole = this.reflector.getAllAndOverride( // 그냥 암기
            ROLES_KEY, // 이 키값을 기준으로 메타데이터를 가져옴
            [
                // 어떤 context에서 가져올지
                context.getHandler(),
                context.getClass(),
            ]
        ) // 이렇게 하면 현재 이 Guard가 적용되있는 문맥상에서 ROLES_KEY 값을 기준으로 metadata를 가져올 수 있음

        // Roles Annotation이 등록 안돼 있음
        if(!requireRole){
            return true; // 애초에 막고싶은 의지가 없다는 의미이므로 그냥 통과
        }

        const {user} = context.switchToHttp().getRequest()

        if(!user){ // RolesGuard 실행 전에 무조건 AccessTokenGuard가 실행돼야 함
            throw new UnauthorizedException(
                '토큰을 제공 해주세요!',
            );
        }

        if(user.role !== requireRole){
            throw new ForbiddenException(
                `이 작업을 수행할 권한이 없습니다. ${requireRole} 권한이 필요합니다`
            );
        }

        return true;
    }
}

// 이 가드를 어디에 등록하는 것이 좋을까?
// if(!requireRole)부분을 작성한 이유는 이 NestJS 애플리케이션 전체에 등록하기 위해 작성한 것!!
// (만약 annotation이 존재하지 않느면 그냥 통과)
// RolesGuard는 전체에 등록해놓고, 이 annotaiton을 넣어준 메서드에서만 가드를 실행되도록 하기 위해 이렇게 만듬
// app.module.ts에서 providers에 추가!!