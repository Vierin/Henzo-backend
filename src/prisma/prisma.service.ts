import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Настраиваем connection pool для работы с Supabase pooler
    const databaseUrl = process.env.DATABASE_URL;
    
    // Добавляем параметры пула соединений, если их нет в URL
    let connectionUrl = databaseUrl;
    if (databaseUrl && !databaseUrl.includes('connection_limit')) {
      const separator = databaseUrl.includes('?') ? '&' : '?';
      connectionUrl = `${databaseUrl}${separator}connection_limit=20&pool_timeout=20`;
    }

    super({
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
