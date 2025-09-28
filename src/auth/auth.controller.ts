import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetUserRoleDto } from './dto/get-user-role.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async registerUser(
    @Body()
    data: {
      userId: string;
      email: string;
      name?: string;
      phone?: string;
      role?: string;
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

  @Put('profile')
  async updateProfile(
    @Body() data: UpdateProfileDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const updatedUser = await this.authService.updateUserProfile(
        currentUser.user.id,
        data,
      );

      return {
        success: true,
        user: updatedUser,
      };
    } catch (error) {
      console.error('❌ Update profile failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to update profile',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('user-role')
  async getUserRole(@Body() data: GetUserRoleDto) {
    try {
      const role = await this.authService.getUserRole(data.userId);
      return { role };
    } catch (error) {
      console.error('❌ Get user role failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to get user role',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch('user-role')
  async updateOwnRole(
    @Body() data: { role: 'CLIENT' | 'OWNER' | 'ADMIN' },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      // Получаем текущего пользователя
      const currentUser = await this.authService.getCurrentUser(authHeader);

      // Пользователь может обновить только свою роль
      const updatedUser = await this.authService.updateUserRole(
        currentUser.user.id,
        data.role,
      );
      return {
        success: true,
        user: updatedUser,
      };
    } catch (error) {
      console.error('❌ Update own role failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to update role',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put('user-role')
  async updateUserRole(
    @Body() data: { userId: string; role: 'CLIENT' | 'OWNER' | 'ADMIN' },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      // Проверяем, что запрос делает админ
      const currentUser = await this.authService.getCurrentUser(authHeader);
      if (currentUser.user.role !== 'ADMIN') {
        throw new Error('Only admins can update user roles');
      }

      const updatedUser = await this.authService.updateUserRole(
        data.userId,
        data.role,
      );
      return {
        success: true,
        user: updatedUser,
      };
    } catch (error) {
      console.error('❌ Update user role failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to update user role',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('sync-user')
  async syncUser(
    @Body() data: { userId: string },
    @Headers('authorization') authHeader: string,
  ) {
    try {
      // Проверяем, что запрос делает админ
      const currentUser = await this.authService.getCurrentUser(authHeader);
      if (currentUser.user.role !== 'ADMIN') {
        throw new Error('Only admins can sync users');
      }

      const user = await this.authService.syncUserFromSupabase(data.userId);
      return {
        success: true,
        user,
      };
    } catch (error) {
      console.error('❌ Sync user failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to sync user',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
