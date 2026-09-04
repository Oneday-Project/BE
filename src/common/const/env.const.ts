const env = 'ENV';
const dbType = 'DB_TYPE';
const dbHost = 'DB_HOST';
const dbPort = 'DB_PORT';
const dbUsername = 'DB_USERNAME';
const dbPassword = 'DB_PASSWORD';
const dbDatabase = 'DB_DATABASE';
const hashRounds = 'HASH_ROUNDS';
const accessTokenSecret = 'ACCESS_TOKEN_SECRET';
const refreshTokenSecret = 'REFRESH_TOKEN_SECRET';

const semanticScholarApi = 'SEMANTIC_SCHOLAR_API_KEY';

const openaiApiKey = 'OPENAI_API_KEY';

// 배포 환경(ENV=prod)에서도 Swagger 문서를 열지 여부.
// ENV를 dev로 바꾸는 방식으로 열면 synchronize/ssl 설정까지 함께 바뀌므로 별도 스위치로 둔다.
const swaggerEnabled = 'SWAGGER_ENABLED';

export const envVariableKeys = {
    env,
    dbType,
    dbHost,
    dbPort,
    dbUsername,
    dbPassword,
    dbDatabase,
    hashRounds,
    accessTokenSecret,
    refreshTokenSecret,
    semanticScholarApi,
    openaiApiKey,
    swaggerEnabled,
}