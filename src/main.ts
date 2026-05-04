import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { envVariableKeys } from './common/const/env.const';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  if (configService.get<string>(envVariableKeys.env) !== 'prod'){
    // Swagger Documentation 만들기
    const config = new DocumentBuilder()
    .setTitle('Oneday Project') // Swagger Documentation의 이름
    .setDescription('휴먼AI공학전공 졸업 프로젝트')
    .setVersion('1.0') // Swagger Documentation의 버전
    .addBearerAuth()
    .build();

    // 웹사이트에 http://localhost:3000/doc 이라고 치면 api가 잘 정리되서 나옴
    // nest-cli.json에 "plugins": ["@nestjs/swagger"]를 넣으면 
    // 우리가 만든 엔티티, DTO들을 기반으로 자동으로 파라미터나 쿼리 등을 생성해줌

    const document = SwaggerModule.createDocument(app, config);

    SwaggerModule.setup('doc', app, document, { // 첫번째 파라미터 - 어디에 셋업할지(일종의 prefix)
      swaggerOptions: {
        persistAuthorization: true, // http://localhost:3000/doc 에서 새로고침해도 로그인 그대로 유지
      }
    })
  }
  
  app.useGlobalPipes(new ValidationPipe({
    transform: true, // DTO에 기본값을 적용할 수 있게 하려면 이 옵션을 넣어야 함
    whitelist: true, // 정의되지 않는 값(프로퍼티)은 입력 불가
    forbidNonWhitelisted: true, // 정의되지 않는 값(프로퍼티)에 대해 에러 발생 
    transformOptions: {
      enableImplicitConversion: true, // ex. DTO에서 타입스크립트 타입 기반으로 입력 값들을 그 타입에 맞게 변경
    }
  }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
