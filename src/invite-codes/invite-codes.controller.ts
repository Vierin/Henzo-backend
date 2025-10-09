import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Body,
  Param,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InviteCodesService } from './invite-codes.service';
import { AuthService } from '../auth/auth.service';

@Controller('invite-codes')
export class InviteCodesController {
  constructor(
    private readonly inviteCodesService: InviteCodesService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Генерировать один инвайт-код (только админ)
   */
  @Post('generate')
  async generateCode(
    @Headers('authorization') authHeader: string,
    @Body()
    body: {
      maxUses?: number;
      source?: string;
      note?: string;
      expiresAt?: string;
    },
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return this.inviteCodesService.generateCode({
        maxUses: body.maxUses,
        source: body.source,
        note: body.note,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        createdById: currentUser.user.id,
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate code',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Генерировать несколько кодов сразу
   */
  @Post('generate-batch')
  async generateBatch(
    @Headers('authorization') authHeader: string,
    @Body()
    body: {
      count: number;
      maxUses?: number;
      source?: string;
      note?: string;
      expiresAt?: string;
    },
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return this.inviteCodesService.generateBatch({
        count: body.count,
        maxUses: body.maxUses,
        source: body.source,
        note: body.note,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        createdById: currentUser.user.id,
      });
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate batch',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Валидировать код (публичный endpoint)
   */
  @Get('validate/:code')
  async validateCode(@Param('code') code: string) {
    return this.inviteCodesService.validateCode(code);
  }

  /**
   * Получить все коды (только админ)
   */
  @Get()
  async getAllCodes(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return this.inviteCodesService.getAllCodes();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get codes',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Получить статистику
   */
  @Get('stats')
  async getStats(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return this.inviteCodesService.getStats();
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get stats',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Отозвать код
   */
  @Put(':id/revoke')
  async revokeCode(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return this.inviteCodesService.revokeCode(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to revoke code',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Удалить код
   */
  @Delete(':id')
  async deleteCode(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      if (currentUser.user.role !== 'ADMIN') {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return this.inviteCodesService.deleteCode(id);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete code',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
