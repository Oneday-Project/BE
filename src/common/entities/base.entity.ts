import { Exclude } from "class-transformer";
import { CreateDateColumn, UpdateDateColumn } from "typeorm";

// 공통적으로 사용하는 id, updatedAt, createdAt 
// 이렇게 3개의 프로퍼티들을 정의한 베이스 클래스를 만들 것임

export abstract class BaseModel {

    @UpdateDateColumn()
    @Exclude({
        toPlainOnly: true,
    })
    updatedAt!: Date;

    @CreateDateColumn()
    @Exclude({
        toPlainOnly: true,
    })
    createdAt!: Date;
}

// 이처럼 공통되는 프로퍼티들을 하나로 모아서 반복되는 코드를 사용하지 않고서
// 엔티티를 구성할 수 있도록 코딩을 할 수 있음(DRY 원칙을 지킬 수 있다!!)