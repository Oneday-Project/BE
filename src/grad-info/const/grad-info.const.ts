// 대학원 진학 정보의 종류.
// 챗봇은 이 값에 따라 답변 규칙을 다르게 적용한다(선배 사례인지, 공식 정보인지 구분해야 하므로).
export enum GradInfoCategory {
    CASE = 'case', // 선배 진학 사례
    ADMISSION = 'admission', // 입시 일정·전형·서류·면접
    PREPARATION = 'preparation', // 준비 방법·컨택·연구계획서
    SCHOOL = 'school', // 대학원·학과·연구실 소개
    SUPPORT = 'support', // 장학금·인건비·병역
    ETC = 'etc', // 기타
}

// 과정 구분
export enum GradInfoDegreeType {
    MASTER = 'master', // 석사
    PHD = 'phd', // 박사
    INTEGRATED = 'integrated', // 석박통합
    COMBINED = 'combined', // 학석사 연계(학부 4학년에 선발되어 석사 과정을 미리 시작하는 과정)
}

// 답변에서 자료의 성격을 밝힐 때 쓰는 라벨.
// "선배 한 사람의 경험"과 "공식 안내"를 섞어서 말하면 안 되기 때문에 종류별로 다르게 부른다.
export const GRAD_INFO_LABELS: Record<GradInfoCategory, string> = {
    [GradInfoCategory.CASE]: '선배 진학 사례',
    [GradInfoCategory.ADMISSION]: '입시 정보',
    [GradInfoCategory.PREPARATION]: '진학 준비 정보',
    [GradInfoCategory.SCHOOL]: '대학원 정보',
    [GradInfoCategory.SUPPORT]: '지원 제도 정보',
    [GradInfoCategory.ETC]: '진학 정보',
};
