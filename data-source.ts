/**
 * schema:log 전용 DataSource — DB에 아무것도 쓰지 않는다.
 *
 * app.module.ts 의 synchronize 를 true 로 켜면 TypeORM 이 어떤 DDL 을 실행할지
 * 미리 확인하기 위한 파일이다. 실제 실행 없이 SQL 만 출력한다.
 *
 *   npx typeorm-ts-node-commonjs schema:log -d data-source.ts
 *
 * .env 를 읽으므로, 확인하려는 DB(Railway / Supabase)의 값을 .env 에 넣고 실행할 것.
 */
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';

// dotenv 가 직접 의존성에 없어서 .env 를 직접 파싱한다.
const envPath = path.join(__dirname, '.env');
const env: Record<string, string> = {};
if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
}

export default new DataSource({
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    // app.module.ts 에 등록된 27개 엔티티와 동일한 집합
    entities: [path.join(__dirname, 'src/**/*.entity.ts')],
    // 이 파일은 조회 전용. 절대 true 로 바꾸지 말 것.
    synchronize: false,
    // app.module.ts 와 동일한 판단 기준을 쓴다 (ENV=prod 면 SSL).
    ssl: env.ENV === 'prod' ? { rejectUnauthorized: false } : false,
});
