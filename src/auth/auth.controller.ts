import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register-client')
  async registerClient(
    @Body()
    data: {
      email: string;
      password: string;
      name?: string;
      phone?: string;
    },
  ) {
    try {
      const result = await this.authService.registerClient(data);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Registration failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('login-client')
  async loginClient(@Body() data: { email: string; password: string }) {
    try {
      const result = await this.authService.loginClient(data);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Login failed',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Get('user')
  async getUser(@Headers('authorization') authHeader: string) {
    try {
      const result = await this.authService.getCurrentUser(authHeader);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get user data',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
