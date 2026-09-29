import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcrypt';
import { envVariableKeys } from 'src/common/const/env.const';
import { LoginUserDto } from './dto/login-user.dto';
import { User } from 'src/users/entities/users.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SmuLoginDto } from './dto/smu-login.dto';
import { SmuAuthClient } from './smu-auth.client';

@Injectable()
export class AuthService {
  constructor (
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly smuAuthClient: SmuAuthClient,
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

  // 샘물(학교 계정) 로그인 — 기본 로그인 수단
  // 1) 학교에 학번/비밀번호를 확인한다(비밀번호는 저장하지 않는다)
  // 2) 학번으로 사용자를 찾는다. 없으면 자동 가입, 있으면 이름·학과를 최신 정보로 갱신
  // 3) 이메일 로그인과 똑같은 형식의 토큰을 발급한다
  async loginWithSmu(dto: SmuLoginDto){
    const profile = await this.smuAuthClient.authenticate(dto.studentId, dto.password);

    // 학번은 입력값이 아니라 학교가 알려준 값을 쓴다(입력에 공백 등이 섞여도 한 사람 = 한 계정이 된다).
    const existingUser = await this.usersService.getUserByStudentId(profile.studentId);

    if (existingUser) {
      const user = await this.usersService.syncSmuProfile(existingUser.id, {
        username: profile.name,
        department: profile.department,
        secondDepartment: profile.secondDepartment,
      });

      return this.loginUser(user);
    }

    const newUser = await this.usersService.createSmuUser({
      studentId: profile.studentId,
      username: profile.name,
      department: profile.department,
      secondDepartment: profile.secondDepartment,
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
      expiresIn: isRefreshToken ? 7200 : 3600,
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
    // 샘물 계정은 비밀번호를 저장하지 않으므로(password가 null) 비교 자체가 불가능하다.
    // bcrypt.compare에 null을 넘기면 에러가 나므로 여기서 먼저 걸러 안내한다.
    if(existingUser && !existingUser.password){
      throw new UnauthorizedException('학교 계정(샘물)으로 로그인해주세요.');
    }

    const passOk = existingUser?.password
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
    
    // 토큰 페이로드는 사용자 id를 sub라는 이름으로 담고 있는데(signToken 참고)
    // signToken은 id를 받으므로, 그대로 펼쳐 넘기면 id가 undefined가 되어
    // 재발급된 토큰에서 sub가 사라진다. 그래서 sub -> id로 되돌려서 넘긴다.
    // 샘물 계정은 email이 없으므로 페이로드의 email도 null일 수 있다(사용자 식별은 sub로 한다).
    return this.signToken({
      email: decoded.email ?? null,
      id: decoded.sub,
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

  // 비밀번호 변경
  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.usersService.findUserById(userId);

    // 샘물 계정은 학교 포털에서 인증하므로 우리 쪽에 바꿀 비밀번호가 없다.
    if (!user.password) {
      throw new BadRequestException(
        '학교 계정(샘물)으로 로그인한 계정은 비밀번호를 변경할 수 없습니다. 학교 포털에서 변경해주세요.',
      );
    }

    // 현재 비밀번호가 맞는지 확인
    const passOk = await bcrypt.compare(dto.currentPassword, user.password);
    if (!passOk) {
        throw new UnauthorizedException('현재 비밀번호가 틀렸습니다.');
    }

    // 새로운 비밀번호를 해시 후 user 엔티티에 저장
    const newPassword = await bcrypt.hash(
        dto.newPassword,
        Number(this.configService.get<number>(envVariableKeys.hashRounds)),
    );

    return this.usersService.updatePassword(userId, newPassword);
  }

}
