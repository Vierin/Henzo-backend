import { Module } from '@nestjs/common';
import { SalonsController } from './salons.controller';
import { SalonsService } from './salons.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SalonsController],
  providers: [SalonsService],
})
export class SalonsModule {}
