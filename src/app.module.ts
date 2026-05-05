import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PapersModule } from './papers/papers.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HaiPapersModule } from './papers/hai-papers/hai-papers.module';
import { MajorCoursesModule } from './major-courses/major-courses.module';
import { MajorCourse } from './major-courses/entities/major-course.entity';
import { Paper } from './papers/entities/papers.entity';
import { RawSemanticScholar } from './papers/entities/raw-semantic-scholar.entity';
import { RawArxiv } from './papers/entities/raw-arxiv.entity';
import { HaiPaper } from './papers/entities/hai-papers.entity';
import { BasicPapersModule } from './papers/basic-papers/basic-papers.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { envVariableKeys } from './common/const/env.const';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/users.entity';
import { AuthModule } from './auth/auth.module';
import { AccessTokenGuard } from './auth/guard/bearer-token.guard';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { RBACGuard } from './auth/guard/rbac.guard';
import { Author } from './papers/entities/authors.entity';
import { ResearchField } from './research-fields/entities/research-fields.entity';
import { AiServicesModule } from './ai-services/ai-services.module';
import { PaperAiSummary } from './ai-services/entities/paper-ai-summaries.entity';
import { ResearchFieldsModule } from './research-fields/research-fields.module';
import { PaperBookmark } from './papers/entities/paper-bookmarks.entity';
import { ResponseTimeInterceptor } from './common/interceptor/response-time.intercepter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 어떤 모듈에서든 ConfigModule에 등록된 환경변수 사용 가능
      validationSchema: Joi.object({ // Joi Validation
        ENV: Joi.string().valid('dev', 'prod').required(),
        DB_TYPE: Joi.string().valid('postgres').required(),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().required(),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_DATABASE: Joi.string().required(),
        HASH_ROUNDS: Joi.number().required(),
        ACCESS_TOKEN_SECRET: Joi.string().required(),
        REFRESH_TOKEN_SECRET: Joi.string().required(),
      })
    }),
    TypeOrmModule.forRootAsync({ 
      useFactory: (configService: ConfigService) => ({ 
        type: configService.get<string>(envVariableKeys.dbType) as "postgres",
        host: configService.get<string>(envVariableKeys.dbHost),
        port: configService.get<number>(envVariableKeys.dbPort),
        username: configService.get<string>(envVariableKeys.dbUsername),
        password: configService.get<string>(envVariableKeys.dbPassword),
        database: configService.get<string>(envVariableKeys.dbDatabase),
        entities: [
          Paper,
          RawSemanticScholar,
          RawArxiv,
          HaiPaper,
          MajorCourse,
          User,
          Author,
          ResearchField,
          PaperAiSummary,
          PaperBookmark,
        ],
        synchronize: true,
      }),
      inject: [ConfigService]
    }),
    PapersModule, 
    BasicPapersModule, 
    HaiPapersModule, 
    MajorCoursesModule, 
    UsersModule, 
    AuthModule, AiServicesModule, ResearchFieldsModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RBACGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTimeInterceptor,
    },
  ],
})
export class AppModule {}
