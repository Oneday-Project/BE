// 계정이 어떤 방식으로 만들어졌는지 구분하는 값
// local - 이메일/비밀번호로 직접 가입한 계정(샘물 로그인이 막혔을 때 쓰는 예비 수단)
// smu   - 샘물(학교 계정) 로그인으로 자동 가입된 계정(비밀번호를 저장하지 않는다)
export enum AuthProviderEnum {
    LOCAL = 'local',
    SMU = 'smu',
}
