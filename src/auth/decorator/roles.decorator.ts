import { SetMetadata } from "@nestjs/common";
import { RolesEnum } from "src/users/const/roles.const";

// <1. Roles Decorator 작업하기 강의>
// 관리자만 post를 삭제할 수 있다고 가정하고 Delete API를 수정해보자

export const ROLES_KEY = 'user-roles';


// @Roles(RolesEnum.ADMIN)이 있는 API는 관리자(ADMIN)가 아니면 사용할 수 없게 만들 것임
// SetMetadata(메타데이터를 저장할 키값, 어떤 정보를 넣을 지);
export const Roles = (role: RolesEnum) => SetMetadata(ROLES_KEY, role);