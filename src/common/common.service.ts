import { BadRequestException, Injectable } from "@nestjs/common";
import { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import { BasePaginationDto } from "./dto/base-pagination.dto";

@Injectable()
export class CommonService {
    constructor(){}

    async pagePagination<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, dto: BasePaginationDto) {
        const {page, take, order} = dto; // order 추가

        const skip = (page! - 1) * take;
        qb.take(take);
        qb.skip(skip);

        this.applyOrderToQb(qb, order);

        const [data, total] = await qb.getManyAndCount();

        return {
            data,
            total, // 전체 데이터 수
            totalPages: Math.ceil(total / take), // 총 페이지 수 
            page, // 현재 페이지
        };
    }

    async cursorPagination<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, dto: BasePaginationDto) {
        let {cursor, order, take} = dto;

        if(cursor){
            const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');

            /**
             * 반환값 형태
             * {
             *  values: {
             *      id: 27 
             *  },
             *  order: ['id_DESC']
             * }
             */
            const cursorObj = JSON.parse(decodedCursor); // string으로 되어있는 json을 실제 json으로 변환

            order = cursorObj.order; // 덮어씀 -> 다음값은 이 cursor를 기반으로 요청 -> 프론트엔드에서 order에 값을 실수로 넣었을 때를 방지
            // 즉 dto의 order에 어떤 값이 입력되더라도 cursor의 order를 기반으로 다음 페이지 요청

            const {values} = cursorObj;
            const columns = Object.keys(values);

            // [변경] 기존의 단순 부등호 비교에서 복합 OR 조건으로 변경
            // 기존: (column1, column2) < (:value1, :value2) 방식
            // → DESC/ASC 방향이 섞인 혼합 정렬을 지원하지 못하는 문제 해결
            //
            // 변경: (col1 > :val1)
            //    OR (col1 = :val1 AND col2 < :val2) 방식
            // → 각 컬럼마다 독립적으로 방향을 적용할 수 있음
            const orConditions: string[] = [];
            const params: Record<string, unknown> = {};

            for(let i = 0; i < columns.length; i++){
                const andParts: string[] = [];

                // 앞선 컬럼들은 = 조건으로 고정
                for(let j = 0; j < i; j++){
                    andParts.push(`${qb.alias}.${columns[j]} = :cursor_${columns[j]}`);
                    params[`cursor_${columns[j]}`] = values[columns[j]];
                }

                // 현재 컬럼은 정렬 방향에 따라 부등호 결정
                const colOrder = order.find(o => o.startsWith(`${columns[i]}_`));
                const operator = colOrder?.endsWith('DESC') ? '<' : '>';

                andParts.push(`${qb.alias}.${columns[i]} ${operator} :cursor_${columns[i]}`);
                params[`cursor_${columns[i]}`] = values[columns[i]];

                orConditions.push(`(${andParts.join(' AND ')})`);
            }

            qb.where(`(${orConditions.join(' OR ')})`, params);
        }

        this.applyOrderToQb(qb, order);

        qb.take(take);

        const data = await qb.getMany();

        const nextCursor = data.length < take ? null : this.generateNextCursor(data, order);

        return {
            data,
            nextCursor,
            hasNext: nextCursor !== null,   // 다음 페이지 존재 여부
        };
    }

    private generateNextCursor<T>(results: T[], order: string[]): string | null {
        if(results.length === 0) return null;

        const lastItem = results[results.length - 1];
        
        const values = {}

        order.forEach((columnOrder) => {
            // [변경] split('_') 에서 lastIndexOf('_') 방식으로 변경
            // 기존: const [column] = columnOrder.split('_');
            // → "created_at_DESC" 처럼 컬럼명에 "_"가 포함된 경우 잘못 파싱되는 문제 해결
            const lastUnderscoreIdx = columnOrder.lastIndexOf('_');
            const column = columnOrder.slice(0, lastUnderscoreIdx);
            values[column] = lastItem[column];
        });

        const cursorObj = {values, order};

        const nextCursor = Buffer.from(JSON.stringify(cursorObj)).toString('base64');

        return nextCursor;
    }

    private applyOrderToQb<T extends ObjectLiteral>(qb: SelectQueryBuilder<T>, order: string[]) {
        for(let i = 0; i < order.length; i++){
            const lastUnderscoreIdx = order[i].lastIndexOf('_');
            const column = order[i].slice(0, lastUnderscoreIdx);
            const direction = order[i].slice(lastUnderscoreIdx + 1);

            if(direction !== 'ASC' && direction !== 'DESC'){
                throw new BadRequestException('Order는 ASC 또는 DESC로 입력해주세요!');
            }

            if(i === 0){
                qb.orderBy(`${qb.alias}.${column}`, direction as 'ASC' | 'DESC');
            }else{
                qb.addOrderBy(`${qb.alias}.${column}`, direction as 'ASC' | 'DESC');
            }
    }
}
}