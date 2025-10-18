import { Module, forwardRef } from '@nestjs/common';
import { InviteCodesController } from './invite-codes.controller';
import { InviteCodesService } from './invite-codes.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule, forwardRef(() => AuthModule)],
  controllers: [InviteCodesController],
  providers: [InviteCodesService],
  exports: [InviteCodesService],
})
export class InviteCodesModule {}


