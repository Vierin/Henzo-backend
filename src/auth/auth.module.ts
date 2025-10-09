import { Module, forwardRef } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaModule } from '../prisma/prisma.module';
import { InviteCodesModule } from '../invite-codes/invite-codes.module';

@Module({
  imports: [PrismaModule, forwardRef(() => InviteCodesModule)],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
