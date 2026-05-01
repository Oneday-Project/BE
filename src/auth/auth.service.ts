import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { envVariableKeys } from 'src/common/const/env.const';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor (
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService, 
    private readonly configService: ConfigService,
  ){}

  async registerWithEmail(user: RegisterUserDto){
    const hash = await bcrypt.hash( 
      user.password,
      Number(this.configService.get<number>(envVariableKeys.hashRounds)),
    );
    
    const newUser = await this.usersService.createUser({
      ...user,
      password: hash,
    });

    return this.loginUser(newUser);
  }

  async loginWithEmail(user: LoginUserDto){
    // 사용자 존재 여부 및 비밀번호 일치 여부 확인
    const existingUser = await this.authenticateWithEmailAndPassword(user);

    // 토큰을 만들어서 반환
    return this.loginUser(existingUser);
  }

  loginUser(user: Pick<User, 'email' | 'id'>){
    return {
      accessToken: this.signToken(user, false),
      refreshToken: this.signToken(user, true),
    }
  }

  signToken(users: Pick<User, 'email' | 'id'>, isRefreshToken: boolean){ 
    //페이로드 형성
    const payload = {
      email: users.email,
      sub: users.id,
      type: isRefreshToken ? 'refresh' : 'access',
    };

    const secret = this.configService.get<string>(
        isRefreshToken ? envVariableKeys.refreshTokenSecret : envVariableKeys.accessTokenSecret
    ) as string;

    // 페이로드를 JWT 토큰으로 사이닝하고서 JWT 형태로 만들어야 함 
    // -> JwtService에서 자동으로 해줌
    // 1st 아큐먼트: payload, 2nd 아규먼트: 옵션
    return this.jwtService.sign(payload, {
      secret, // Signature를 만들 때 사용하는 비밀 키

      // 만료될 때까지 얼마나 시간이 걸릴 건지(초(seconds) 단위)
      // refreshToken이나 accessToken이냐에 따라 만료기간을 다루게 둘 것임
      expiresIn: isRefreshToken ? 3600 : 600,
    })
  }

    // 여기서 UsersModel의 password는 해시가 적용된 비번인데 그냥 이렇게 하는걸로 하자 ㄱㅊㄱㅊ
  async authenticateWithEmailAndPassword(user: LoginUserDto){
    /**
     * 1. 사용자가 존재하는 지 확인(email) 
     * -> 사용자의 DB정보를 엑세스할 수 있는 User레포지토리를 auth.module.ts에 입력해서 주입 받아서 할 수도 있음
     * -> 그런데 강사는 User와 관련된 기능들을 userService안에서 직접 선언해 두고 
     *    그 기능들을 불러와서 사용하는 것을 좋아한다고 함
     * 2. 비밀번호가 맞는지 확인
     * 3. 모두 통과되면 찾은 사용자 정보 반환
     */

    // 1. 사용자가 존재하는 지 확인(email) 
    const existingUser = await this.usersService.getUserByEmail(user.email);

    // 2. 비밀번호가 맞는지 확인
    // import * as bcrypt from 'bcrypt'; 추가
    /**
     * compare() 파라미터
     * 1) 입력된 비밀번호
     * 2) 기존 해시 (hash) -> 사용자 정보에 저장돼있는 hash
     * 해시 후에 비교하는 절차를 compare()가 자동으로 해줌
     */
    // users.password - 실제로 입력받은 비밀번호
    // existingUser.password - 해시로 저장돼있는 값
    const passOk = existingUser 
      ? await bcrypt.compare(user.password, existingUser.password)
      : false

    if(!existingUser || !passOk){
      throw new UnauthorizedException('이메일 또는 비밀번호가 틀렸습니다.');
    }

    return existingUser; // 사용자 정보 반환
  }

  // isRefreshToken - 발급받을 토큰이 RefreshToken인지 
  rotateToken(refreshToken: string, isRefreshToken: boolean){
    let decoded: any;

    // verify() - 검증이 되면 페이로드, 안되면 에러를 반환
    try {
      decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>(envVariableKeys.refreshTokenSecret),
      });
    } catch (e) {
      throw new UnauthorizedException('Refresh 토큰이 만료됐거나 유효하지 않습니다.');
    }

    if (decoded.type !== 'refresh') {
      throw new UnauthorizedException('토큰 재발급은 Refresh 토큰으로만 가능합니다!');
    }
    
    return this.signToken({
      ...decoded,
      }, isRefreshToken); // isRefreshToken - true면 refresh토큰 발급, false면 access토큰 발급

  }

  extractTokenFromHeader(header: string){ // 토큰 추출 함수
    // 'Basic {token}' -> [Basic, {token}]
    const splitToken = header.split(' ');

    // 서버는 클라이언트에서 잘못된 값이 들어올 가능성이 있다는 것을 항상 가정해야 함!!
    if(splitToken.length !== 2 || splitToken[0] !== 'Bearer'){
        throw new UnauthorizedException('Bearer토큰만 입력 가능합니다!');
    }

    const token = splitToken[1];

    return token;
  }

  verifyToken(token: string){
    try{
      const decoded = this.jwtService.decode(token);
      const isRefreshToken = decoded.type === 'refresh';

      return this.jwtService.verify(token, {
        secret: this.configService.get<string>(
            isRefreshToken ? envVariableKeys.refreshTokenSecret : envVariableKeys.accessTokenSecret
        ),
      });
    }catch(e){
      throw new UnauthorizedException('토큰이 만료됐거나 잘못된 토큰입니다.');
    }
}

}
