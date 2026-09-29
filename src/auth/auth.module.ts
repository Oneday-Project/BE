import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from 'src/users/users.module';
import { SmuAuthClient } from './smu-auth.client';
import { SmuLoginThrottleGuard } from './guard/smu-login-throttle.guard';

@Module({
  imports: [
    JwtModule.register({}),   
    UsersModule, 
  ],
  controllers: [AuthController],
  providers: [AuthService, SmuAuthClient, SmuLoginThrottleGuard],
  exports: [AuthService],
})
export class AuthModule {}
