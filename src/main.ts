import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
