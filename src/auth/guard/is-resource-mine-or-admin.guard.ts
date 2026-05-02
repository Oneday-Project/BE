import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { RolesEnum } from "src/users/const/roles.const";
import { Request } from "express";
import { UsersService } from "src/users/users.service";
import { User } from "src/users/entities/user.entity";

abstract class IsResourceMineOrAdminGuard implements CanActivate {
    abstract isResourceMine(userId: number, resourceId: number): Promise<boolean>;
    abstract getResourceId(req: Request): string;

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest() as Request & { user: User };
        const { user } = req;

        if (!user) throw new UnauthorizedException('사용자 정보를 가져올 수 없습니다.');

        if (user.role === RolesEnum.ADMIN) return true;

        const resourceId = this.getResourceId(req);
        const isOk = await this.isResourceMine(user.id, parseInt(resourceId));

        if (!isOk) throw new ForbiddenException('권한이 없습니다.');
        return true;
    }
}

// // 사용 예시
// @Injectable()
// export class IsRoadmapMineAdminGuard extends IsResourceMineOrAdminGuard {
//     constructor(private readonly roadsmapService: roadmapsService) { super(); }
//     isResourceMine(userId: number, resourceId: number) {
//         return this.roadsmapService.isRoadmapMine(userId, resourceId);
//     }
//     getResourceId(req: Request) { return req.params.roadmapId as string; }
// }


// 마이페이지용 - 사용자는 본인의 마이페이지에만 접근 가능
@Injectable()
export class IsMyInfoOrAdminGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest() as Request & { user: User };
        const { user } = req;

        if (!user) throw new UnauthorizedException('사용자 정보를 가져올 수 없습니다.');
        if (user.role === RolesEnum.ADMIN) return true;

        const targetUserId = parseInt(req.params.userId as string);

        if (user.id !== targetUserId) throw new ForbiddenException('권한이 없습니다.');
        return true;
    }
}