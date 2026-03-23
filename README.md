# 🧩 백엔드 ![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)

---
## 깃허브 -> 로컬
- git clone으로 받아오면 npm install을 터미널에 입력 -> 필요한 패키지 모두 설치 가능
---
## 🌐 NestJS 기본 실행 시 접속 URL
- http://localhost:3000
---
## 🚀 프로젝트 생성 및 실행

```
# 현재 폴더에 NestJS 프로젝트 생성
nest new . 
-> npm 선택

# 실행
npm run start:dev

# DB가 존재할 때의 실행 절차
docker-compose up -> npm run start:dev -> 개발 -> Postman 테스트

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
npm install @nestjs/typeorm typeorm pg
```

### 🔐 인증
```
# 관련 패키지 설치
npm install @nestjs/jwt bcrypt
-> 사용자 인증 관련 패키지 설치
```

### 🧾 Validation
```
# 관련 패키지 설치
npm install class-validator class-transformer
-> 클래스 validator, transformer사용을 위한 설치
```

### ⚙️ 환경 변수 관리
```
# 관련 패키지 설치
npm install @nestjs/config
```

### 📁 파일 업로드
```
# 관련 패키지 설치
npm install multer @types/multer uuid @types/uuid
-> 파일 업로드를 위해 필요한 모듈
```

### 🖼️ Static 파일 제공
```
# 관련 패키지 설치
npm install @nestjs/serve-static
-> 파일(static file)을 외부에서 가져가서 보여줄 수 있도록 해주는 기능
```

### 🔌 WebSocket
```
# 관련 패키지 설치
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io

# 문제 발생 시
npm install @nestjs/common @nestjs/core @nestjs/jwt @nestjs/platform-express @nestjs/platform-socket.io @nestjs/typeorm @nestjs/websockets
-> Nest 관련 패키지를 동일한 최신 버전으로 재설치
```



