import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { catchError, Observable, tap } from "rxjs";
import { DataSource } from "typeorm";

@Injectable()
export class TransactionInterceptor implements NestInterceptor{
    constructor(
        private readonly dataSource: DataSource,
    ){}

    async intercept(context: ExecutionContext, next: CallHandler<any>): Promise<Observable<any>> {
        const req = context.switchToHttp().getRequest();

        // 트랜잭션과 관련된 모든 쿼리를 담당할 쿼리 러너를 생성한다
        const qr = this.dataSource.createQueryRunner();
    
        // 쿼리 러너에 연결한다
        await qr.connect();
        // 쿼리 러너에서 트랜잭션을 시작한다.
        // 이 시점부터 같은 쿼리 러너(여기서는 qr객체)를 사용하면 
        // 트랜잭션 안에서 데이터베이스 액션을 묶어서 실행 할 수 있다.
    
        await qr.startTransaction();

        req.queryRunner = qr; // 컨트롤러에서 createPost()와 createPostImage()에 qr를 넣어주기 위해 작성

        return next.handle()
            .pipe(
                catchError( // 에러가 났을 때 실행하는 함수도 제공
                    async (e) => {
                        await qr.rollbackTransaction();
                        await qr.release();

                        throw e;
                    }
                ),
                tap(async ()=>{
                    await qr.commitTransaction();
                    await qr.release();
                })
            );
    }
}

// 이렇게 중간 로직만 남기고 interceptor로 트랜잭션을 적용 가능