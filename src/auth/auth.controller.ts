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
import { RegisterClientDto } from './dto/register-client.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async registerOwner(
    @Body()
    data: {
      userId: string;
      email: string;
      name?: string;
      phone?: string;
    },
  ) {
    try {
      const result = await this.authService.registerOwner(data);
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Registration failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('register-client')
  async registerClient(@Body() data: RegisterClientDto) {
    try {
      console.log('📝 Received client registration request:', {
        email: data.email,
        name: data.name,
      });
      const result = await this.authService.registerClient(data);
      console.log('✅ Client registration successful:', {
        email: data.email,
        userId: result.user.id,
      });
      return result;
    } catch (error) {
      console.error('❌ Client registration failed:', error.message);
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
      console.log(
        '📝 Received get user request, authHeader:',
        authHeader ? 'Present' : 'Missing',
      );
      const result = await this.authService.getCurrentUser(authHeader);
      console.log('✅ Get user successful:', result.user.email);
      return result;
    } catch (error) {
      console.error('❌ Get user failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to get user data',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }
}
