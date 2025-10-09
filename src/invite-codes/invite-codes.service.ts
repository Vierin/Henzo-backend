import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { nanoid } from 'nanoid';

@Injectable()
export class InviteCodesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Генерирует новый инвайт-код
   */
  async generateCode(data: {
    maxUses?: number;
    source?: string;
    note?: string;
    expiresAt?: Date;
    createdById: string;
  }) {
    // Генерируем короткий читаемый код (8 символов)
    const code = nanoid(8).toUpperCase();

    const inviteCode = await this.prisma.inviteCode.create({
      data: {
        code,
        maxUses: data.maxUses || 1,
        source: data.source,
        note: data.note,
        expiresAt: data.expiresAt,
        createdById: data.createdById,
        status: 'ACTIVE',
      },
    });

    return {
      ...inviteCode,
      registrationLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/business/register?invite=${code}`,
    };
  }

  /**
   * Генерирует несколько кодов сразу
   */
  async generateBatch(data: {
    count: number;
    maxUses?: number;
    source?: string;
    note?: string;
    expiresAt?: Date;
    createdById: string;
  }) {
    const codes: Awaited<ReturnType<typeof this.generateCode>>[] = [];
    for (let i = 0; i < data.count; i++) {
      const code = await this.generateCode({
        maxUses: data.maxUses,
        source: data.source,
        note: data.note ? `${data.note} (${i + 1}/${data.count})` : undefined,
        expiresAt: data.expiresAt,
        createdById: data.createdById,
      });
      codes.push(code);
    }
    return codes;
  }

  /**
   * Валидирует инвайт-код
   */
  async validateCode(
    code: string,
  ): Promise<{ valid: boolean; error?: string; inviteCodeId?: string }> {
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { code },
    });

    if (!inviteCode) {
      return { valid: false, error: 'Invalid invite code' };
    }

    if (inviteCode.status !== 'ACTIVE') {
      return { valid: false, error: 'This invite code is no longer active' };
    }

    if (inviteCode.expiresAt && inviteCode.expiresAt < new Date()) {
      // Автоматически помечаем как истекший
      await this.prisma.inviteCode.update({
        where: { id: inviteCode.id },
        data: { status: 'EXPIRED' },
      });
      return { valid: false, error: 'This invite code has expired' };
    }

    if (inviteCode.usedCount >= inviteCode.maxUses) {
      // Автоматически помечаем как исчерпанный
      await this.prisma.inviteCode.update({
        where: { id: inviteCode.id },
        data: { status: 'EXHAUSTED' },
      });
      return { valid: false, error: 'This invite code has been fully used' };
    }

    return { valid: true, inviteCodeId: inviteCode.id };
  }

  /**
   * Отмечает использование кода
   */
  async markAsUsed(codeId: string) {
    const inviteCode = await this.prisma.inviteCode.findUnique({
      where: { id: codeId },
    });

    if (!inviteCode) {
      throw new NotFoundException('Invite code not found');
    }

    const updatedCode = await this.prisma.inviteCode.update({
      where: { id: codeId },
      data: {
        usedCount: inviteCode.usedCount + 1,
      },
    });

    // Если достигнут лимит, помечаем как исчерпанный
    if (updatedCode.usedCount >= updatedCode.maxUses) {
      await this.prisma.inviteCode.update({
        where: { id: codeId },
        data: { status: 'EXHAUSTED' },
      });
    }

    return updatedCode;
  }

  /**
   * Получить все инвайт-коды
   */
  async getAllCodes() {
    const codes = await this.prisma.inviteCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        usedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    return codes.map((code) => ({
      ...code,
      registrationLink: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/business/register?invite=${code.code}`,
    }));
  }

  /**
   * Отозвать код
   */
  async revokeCode(codeId: string) {
    return this.prisma.inviteCode.update({
      where: { id: codeId },
      data: { status: 'REVOKED' },
    });
  }

  /**
   * Удалить код (только если не использован)
   */
  async deleteCode(codeId: string) {
    const code = await this.prisma.inviteCode.findUnique({
      where: { id: codeId },
    });

    if (!code) {
      throw new NotFoundException('Invite code not found');
    }

    if (code.usedCount > 0) {
      throw new BadRequestException('Cannot delete a code that has been used');
    }

    return this.prisma.inviteCode.delete({
      where: { id: codeId },
    });
  }

  /**
   * Статистика по кодам
   */
  async getStats() {
    const total = await this.prisma.inviteCode.count();
    const active = await this.prisma.inviteCode.count({
      where: { status: 'ACTIVE' },
    });
    const used = await this.prisma.inviteCode.count({
      where: { usedCount: { gt: 0 } },
    });

    const totalUses = await this.prisma.inviteCode.aggregate({
      _sum: { usedCount: true },
    });

    return {
      total,
      active,
      used,
      totalUses: totalUses._sum.usedCount || 0,
    };
  }
}
