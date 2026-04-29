# 🧩 백엔드 ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)

---
## 깃허브 -> 로컬
```
# 1. git clone (처음에만 실행 -> 만약 기존 프로젝트 폴더에서 또 한다면 그 이후부터는 git pull이나 git fetch로 가져오기)
git clone https://github.com/Oneday-Project/BE.git .

# 2. postgres-data.zip 압축 해제
이게 가장 불편한 점.. -> 깃허브에 postgres-data폴더를 올리고 clone으로 가져오면 파일이 손상됨..
만약 DB가 추가/수정된 것이 있다면 팀원들에게 공지 후 zip파일을 깃허브에 올려줘..

# 3. 의존성 설치
터미널 -> pnpm install

# 4. .env 파일 추가

# 5. 도커 실행
docker-compose up

# 6. 개발 서버 실행
pnpm start:dev
```
---
## 로컬 -> 깃허브
```
# 1. 브랜치 생성 및 변경(각자 할당된 브랜치 사용)
git branch jungwoo 또는 git branch yerin
git switch jungwoo 또는 git switch yerin

# 2. 개발

# 3. 깃허브 업로드(각자 할당된 브랜치 사용)
git add .
git commit -m "커밋 메시지(알아서 작성)"
git push -u origin jungwoo 또는 git push -u origin yerin
```
---

## 🌐 NestJS 기본 실행 시 접속 URL
- http://localhost:3000
---
## 🚀 프로젝트 생성 및 실행

```
# 현재 폴더에 NestJS 프로젝트 생성
nest new . 
-> pnpm 선택

# 실행
pnpm start:dev

# DB가 존재할 때의 실행 절차
docker-compose up -> pnpm start:dev -> 개발 -> Postman 테스트

# NestJS 리소스 생성
nest g resource
->  What name would you like to use for this resource (plural, e.g., "users")? --> 원하는 폴더명 입력
-> What transport layer do you use? --> REST API 선택
-> Would you like to generate CRUD entry points? (Y/n) --> n
```
---
## 📦 패키지 설치

### 🐳 Docker
```
# 도커 설치 확인
docker --version

# 도커 실행
docker-compose up

# 도커 종료
docker-compose down
```

### 🗄️ DB (TypeORM + PostgreSQL)
```
# 관련 패키지 설치
pnpm install @nestjs/typeorm typeorm pg
```

### 🔐 인증
```
# 관련 패키지 설치
pnpm install @nestjs/jwt bcrypt
-> 사용자 인증 관련 패키지 설치
```

### 🧾 Validation
```
# 관련 패키지 설치
pnpm install class-validator class-transformer
-> 클래스 validator, transformer사용을 위한 설치
```

### ⚙️ 환경 변수 관리
```
# 관련 패키지 설치
pnpm install @nestjs/config
```

### 📁 파일 업로드
```
# 관련 패키지 설치
pnpm install multer @types/multer uuid @types/uuid
-> 파일 업로드를 위해 필요한 모듈
```

### 🖼️ Static 파일 제공
```
# 관련 패키지 설치
pnpm install @nestjs/serve-static
-> 파일(static file)을 외부에서 가져가서 보여줄 수 있도록 해주는 기능
```

### 🔌 WebSocket
```
# 관련 패키지 설치
pnpm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# 문제 발생 시
pnpm install @nestjs/common @nestjs/core @nestjs/jwt @nestjs/platform-express @nestjs/platform-socket.io @nestjs/typeorm @nestjs/websockets
-> Nest 관련 패키지를 동일한 최신 버전으로 재설치
```



