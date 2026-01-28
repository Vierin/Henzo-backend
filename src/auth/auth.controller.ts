import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Headers,
  Query,
  Param,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { GetUserRoleDto } from './dto/get-user-role.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-business-magic-link')
  async sendBusinessMagicLink(@Body() data: { email: string; name: string; password: string }) {
    try {
      console.log('📧 Send business magic link request:', {
        email: data.email,
        name: data.name,
        hasPassword: !!data.password,
      });
      const result = await this.authService.sendBusinessMagicLink(
        data.email,
        data.name,
        data.password,
      );
      console.log('✅ Business magic link sent successfully');
      return result;
    } catch (error) {
      console.error('❌ Send business magic link failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to send magic link',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('register')
  async registerUser(
    @Body()
    data: {
      userId: string | null;
      email: string;
      password?: string;
      name?: string;
      role?: string;
      magicLinkToken?: string;
    },
  ) {
    try {
      console.log('📝 POST /auth/register called with:', {
        userId: data.userId,
        email: data.email,
        hasPassword: !!data.password,
        role: data.role,
      });
      const result = await this.authService.registerOwner(data);
      console.log('✅ Registration successful');
      return result;
    } catch (error: any) {
      console.error('❌ Registration error:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
      });
      throw new HttpException(
        error.message || 'Registration failed',
        error.status || HttpStatus.BAD_REQUEST,
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

  @Get('initialize')
  async initialize(
    @Headers('authorization') authHeader: string,
    @Query('includeSalon') includeSalon?: string,
  ) {
    try {
      console.log('📝 Received initialize request');
      const result = await this.authService.initializeUser(authHeader, {
        includeSalon: includeSalon === 'true',
      });
      console.log('✅ Initialize successful:', result.user.email);
      return result;
    } catch (error) {
      console.error('❌ Initialize failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to initialize user',
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

  @Delete('account')
  async deleteAccount(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const result = await this.authService.deleteUserAccount(
        currentUser.user.id,
      );

      return {
        success: true,
        message: 'Account deleted successfully',
        data: result,
      };
    } catch (error) {
      console.error('❌ Delete account failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to delete account',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('favorites')
  async getFavoriteSalons(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      const favorites = await this.authService.getFavoriteSalons(
        currentUser.user.id,
      );

      return {
        success: true,
        favorites,
      };
    } catch (error) {
      console.error('❌ Get favorites failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to get favorite salons',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('favorites/:salonId')
  async addFavoriteSalon(
    @Headers('authorization') authHeader: string,
    @Body() body: { salonId: string },
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      const updatedUser = await this.authService.addFavoriteSalon(
        currentUser.user.id,
        body.salonId,
      );

      return {
        success: true,
        message: 'Salon added to favorites',
        favoriteSalons: updatedUser.favoriteSalons,
      };
    } catch (error) {
      console.error('❌ Add favorite failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to add salon to favorites',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('favorites/:salonId')
  async removeFavoriteSalon(
    @Headers('authorization') authHeader: string,
    @Body() body: { salonId: string },
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      const updatedUser = await this.authService.removeFavoriteSalon(
        currentUser.user.id,
        body.salonId,
      );

      return {
        success: true,
        message: 'Salon removed from favorites',
        favoriteSalons: updatedUser.favoriteSalons,
      };
    } catch (error) {
      console.error('❌ Remove favorite failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to remove salon from favorites',
        HttpStatus.BAD_REQUEST,
      );
    }
  }


  @Get('verify-business-magic-link')
  async verifyBusinessMagicLink(
    @Query('token') token: string,
    @Query('locale') locale?: string,
  ) {
    try {
      if (!token) {
        throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
      }
      const result = await this.authService.verifyBusinessMagicLink(token, locale);
      return result;
    } catch (error) {
      console.error('❌ Verify business magic link failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to verify magic link',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('business-magic-link/:token')
  async redirectBusinessMagicLink(
    @Param('token') token: string,
    @Query('locale') locale?: string,
    @Headers('accept-language') acceptLanguage?: string,
    @Res() res: Response,
  ) {
    try {
      if (!token) {
        const frontendUrl =
          process.env.FRONTEND_URL ||
          (process.env.NODE_ENV === 'production' ? 'https://henzo.app' : 'http://localhost:3000');
        return res.redirect(`${frontendUrl}/en/business/register?error=invalid_link`);
      }

      // Определяем locale: из query параметра, из Accept-Language заголовка, или дефолтный 'en'
      let detectedLocale = locale;
      if (!detectedLocale && acceptLanguage) {
        const lang = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase();
        if (lang === 'ru' || lang === 'en' || lang === 'vi') {
          detectedLocale = lang;
        }
      }
      if (!detectedLocale || (detectedLocale !== 'ru' && detectedLocale !== 'en' && detectedLocale !== 'vi')) {
        detectedLocale = 'en';
      }

      console.log(`🔍 Processing business magic link with locale: ${detectedLocale}`);

      const result = await this.authService.verifyBusinessMagicLink(token, detectedLocale);

      if (result.success && result.magicLinkUrl) {
        // Редиректим напрямую на Supabase magic link
        console.log('✅ Redirecting to Supabase magic link');
        return res.redirect(result.magicLinkUrl);
      }

      // Если нет magicLinkUrl, редиректим на страницу регистрации с ошибкой
      const frontendUrl =
        process.env.FRONTEND_URL ||
        (process.env.NODE_ENV === 'production' ? 'https://henzo.app' : 'http://localhost:3000');
      return res.redirect(
        `${frontendUrl}/${detectedLocale}/business/register?error=verification_failed`,
      );
    } catch (error) {
      console.error('❌ Redirect business magic link failed:', error.message);
      const frontendUrl =
        process.env.FRONTEND_URL ||
        (process.env.NODE_ENV === 'production' ? 'https://henzo.app' : 'http://localhost:3000');
      
      // Определяем locale для ошибки
      let detectedLocale = locale;
      if (!detectedLocale && acceptLanguage) {
        const lang = acceptLanguage.split(',')[0]?.split('-')[0]?.toLowerCase();
        if (lang === 'ru' || lang === 'en' || lang === 'vi') {
          detectedLocale = lang;
        }
      }
      if (!detectedLocale || (detectedLocale !== 'ru' && detectedLocale !== 'en' && detectedLocale !== 'vi')) {
        detectedLocale = 'en';
      }
      
      let errorParam = 'verification_failed';
      if (error.message?.includes('expired')) {
        errorParam = 'link_expired';
      } else if (error.message?.includes('Invalid')) {
        errorParam = 'invalid_link';
      }

      return res.redirect(`${frontendUrl}/${detectedLocale}/business/register?error=${errorParam}`);
    }
  }
}
