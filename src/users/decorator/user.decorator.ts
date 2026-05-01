import { createParamDecorator, ExecutionContext, InternalServerErrorException } from "@nestjs/common";
import { User as UserModel } from "../entities/user.entity";

// 일반적으로 데코레이터 이름은 대문자로 시작
export const User = createParamDecorator((data: keyof UserModel | undefined, context: ExecutionContext)=>{ // 파라미터로 콜백함수 넣기. 
    // 이 함수 안에 데코레이터가 어떤 역할을 할지 정보를 담음
    // data: 데코레이터 안에 입력해주는 값(User데코레이터는 사용자를 가져올 뿐이므로 우리는 사용X)
    // context:ExecutionContext ->  가드 만들 때의 context와 같음
    const req = context.switchToHttp().getRequest();

    const user = req.user as UserModel;

    if(!user){ // 물론 access토큰 가드를 사용한다면 user가 없을 일은 없지만 가드 미사용을 대비한 코드
        throw new InternalServerErrorException('User 데코레이터는 AccessTokenGuard와 함께 사용해야 합니다. Request에 user 프로퍼티가 존재하지 않습니다!');
        // 이 에러를 던지는 이유
        // User데코레이터는 무조건 Access토큰 가드를 사용한 상태에서 사용할 수 있다는 가정 하에 설계
        // 그러므로 사용자를 찾을 수 없다면 그것은 클라이언트가 잘못 한것이 아니라 서버에서 잘못한 거라고 알려주기 위함
        // 이 에러가 출력된다면 이 User데코레이터를 액세스 토큰 가드와 함께 사용하지 않아서 문제가 생겼다는 것을 인지 가능
    }

    if(data) {
        return user[data];
    }

    return user;
})

// data: keyof UsersModel | undefined
// = data에는 UsersModel의 키값들만 들어가거나 undefined가 들어갈 수 있다
// -> if(data)문에서 문제가 발생할 일은 없음
// undefined 일때는 사용자를 그대로 반환(원래 하던대로)
