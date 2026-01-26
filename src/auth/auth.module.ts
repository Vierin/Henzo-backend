import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtVerifierService } from './jwt-verifier.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService, JwtVerifierService],
  exports: [AuthService],
})
export class AuthModule {}
