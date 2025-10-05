import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { supabase } from '../lib/supabase';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async registerOwner(data: {
    userId: string;
    email: string;
    name?: string;
    role?: string;
  }) {
    try {
      // Проверяем, существует ли пользователь в нашей базе данных
      const existingUser = await this.prisma.user.findUnique({
        where: { id: data.userId },
      });

      if (existingUser) {
        throw new Error('User already exists in database');
      }

      // Создаем запись пользователя в нашей базе данных
      const user = await this.prisma.user.create({
        data: {
          id: data.userId,
          email: data.email,
          name: data.name,
          role: (data.role as 'OWNER' | 'CLIENT' | 'ADMIN') || 'OWNER',
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
      };
    } catch (error) {
      throw new Error(`Owner registration failed: ${error.message}`);
    }
  }

  async registerClient(data: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) {
    try {
      console.log('🔐 Starting client registration for:', data.email);

      // Проверяем, существует ли пользователь в нашей базе данных
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        console.log('❌ User already exists:', data.email);
        throw new Error('User with this email already exists');
      }

      console.log(
        '✅ User not found in database, proceeding with registration',
      );

      // Создаем пользователя в Supabase (отключаем подтверждение email для разработки)
      console.log('📧 Creating user in Supabase...');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: undefined, // Отключаем перенаправление
        },
      });

      if (authError) {
        console.error('❌ Supabase auth error:', authError.message);
        throw new Error(authError.message);
      }

      if (!authData.user) {
        console.error('❌ No user data returned from Supabase');
        throw new Error('Failed to create user');
      }

      console.log('✅ User created in Supabase:', authData.user.id);

      // Создаем запись пользователя в нашей базе данных
      const user = await this.prisma.user.create({
        data: {
          id: authData.user.id,
          email: data.email,
          name: data.name,
          phone: data.phone,
          role: 'CLIENT',
        },
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        session: authData.session,
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  async loginClient(data: { email: string; password: string }) {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Login failed');
      }

      // Получаем информацию о пользователе из нашей базы данных
      const user = await this.prisma.user.findUnique({
        where: { id: authData.user.id },
      });

      if (!user) {
        throw new Error('User not found in database');
      }

      if (user.role !== 'CLIENT') {
        throw new Error('Only clients can access this endpoint');
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        session: authData.session,
      };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async getCurrentUser(authHeader: string) {
    try {
      console.log(
        '🔐 Getting current user, authHeader:',
        authHeader ? 'Present' : 'Missing',
      );

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ No valid authorization header provided');
        throw new Error('No authorization header provided');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log('🔑 Token extracted, length:', token.length);

      // Verify the token with Supabase
      console.log('🔍 Verifying token with Supabase...');
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error) {
        console.error('❌ Supabase token verification error:', error.message);
        throw new Error('Invalid token');
      }

      if (!user) {
        console.log('❌ No user returned from Supabase');
        throw new Error('User not found');
      }

      console.log('✅ User verified in Supabase:', user.id, user.email);

      // Get user data from our database
      console.log('🔍 Looking up user in database...');
      let dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      // If user not found by ID, try to find by email (for Google OAuth cases)
      if (!dbUser && user.email) {
        console.log('🔍 User not found by ID, trying to find by email...');
        dbUser = await this.prisma.user.findUnique({
          where: { email: user.email },
        });

        if (dbUser) {
          console.log(
            '✅ Found existing user by email, updating ID to match Supabase Auth...',
          );
          const oldUserId = dbUser.id;

          // Update all related records to use the new Supabase Auth ID
          await this.prisma.$transaction(async (prisma) => {
            // Update salons
            await prisma.salon.updateMany({
              where: { ownerId: oldUserId },
              data: { ownerId: user.id },
            });

            // Update bookings
            await prisma.booking.updateMany({
              where: { userId: oldUserId },
              data: { userId: user.id },
            });

            // Update reviews
            await prisma.review.updateMany({
              where: { userId: oldUserId },
              data: { userId: user.id },
            });

            // Update user ID
            await prisma.user.update({
              where: { id: oldUserId },
              data: { id: user.id },
            });
          });

          // Get updated user
          dbUser = await this.prisma.user.findUnique({
            where: { id: user.id },
          });
        }
      }

      // Если пользователь не найден в базе данных, но существует в Supabase Auth,
      // создаем его автоматически с ролью из метаданных или CLIENT по умолчанию
      if (!dbUser) {
        console.log('⚠️ User not found in database, creating automatically...');
        try {
          // Проверяем, есть ли у пользователя салоны (для восстановления роли OWNER)
          const existingSalons = await this.prisma.salon.findMany({
            where: { ownerId: user.id },
          });

          // Если у пользователя есть салоны, создаем его с ролью OWNER
          // Иначе создаем с ролью CLIENT по умолчанию
          const userRole = existingSalons.length > 0 ? 'OWNER' : 'CLIENT';

          dbUser = await this.prisma.user.create({
            data: {
              id: user.id,
              email: user.email || '',
              name:
                user.user_metadata?.name ||
                user.user_metadata?.full_name ||
                null,
              phone: user.user_metadata?.phone || null,
              role: userRole as 'CLIENT' | 'OWNER' | 'ADMIN',
            },
          });
          console.log(
            `✅ User created automatically in database with role ${userRole}:`,
            dbUser.id,
          );
        } catch (createError) {
          console.error(
            '❌ Failed to create user in database:',
            createError.message,
          );
          throw new Error('Failed to create user in database');
        }
      }

      console.log('✅ User found in database:', dbUser.id, dbUser.email);

      return {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          phone: dbUser.phone,
          role: dbUser.role,
        },
      };
    } catch (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  async updateUserProfile(userId: string, data: UpdateProfileDto) {
    try {
      // Update user in database
      const updatedUser = await this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
        },
      });

      return updatedUser;
    } catch (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }
  }

  async getUserRole(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user.role;
    } catch (error) {
      throw new Error(`Failed to get user role: ${error.message}`);
    }
  }

  async updateUserRole(userId: string, role: 'CLIENT' | 'OWNER' | 'ADMIN') {
    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
        },
      });

      return updatedUser;
    } catch (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  }

  async syncUserFromSupabase(supabaseUserId: string) {
    try {
      // Получаем данные пользователя из Supabase Auth
      const {
        data: { user },
        error,
      } = await supabase.auth.admin.getUserById(supabaseUserId);

      if (error || !user) {
        throw new Error('User not found in Supabase Auth');
      }

      // Проверяем, существует ли пользователь в нашей базе данных
      const existingUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      if (existingUser) {
        return existingUser;
      }

      // Создаем пользователя в нашей базе данных
      const newUser = await this.prisma.user.create({
        data: {
          id: user.id,
          email: user.email || '',
          name:
            user.user_metadata?.name || user.user_metadata?.full_name || null,
          phone: user.user_metadata?.phone || null,
          role: 'CLIENT', // По умолчанию CLIENT
        },
      });

      return newUser;
    } catch (error) {
      throw new Error(`Failed to sync user: ${error.message}`);
    }
  }

  async deleteUserAccount(userId: string) {
    try {
      console.log(`🗑️ Starting account deletion for user: ${userId}`);

      // Получаем информацию о пользователе
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          salons: true,
          bookings: true,
          reviews: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      console.log(`📊 User data to delete:`, {
        userId: user.id,
        email: user.email,
        role: user.role,
        hasSalon: !!user.salons && user.salons.length > 0,
        bookingsCount: user.bookings.length,
        reviewsCount: user.reviews.length,
      });

      // Удаляем связанные данные в зависимости от роли
      if (user.role === 'OWNER' && user.salons && user.salons.length > 0) {
        const salon = user.salons[0];
        console.log(`🏢 Deleting salon data for owner: ${salon.id}`);

        // Удаляем все связанные с салоном данные
        await this.prisma.booking.deleteMany({
          where: { salonId: salon.id },
        });

        await this.prisma.review.deleteMany({
          where: { salonId: salon.id },
        });

        await this.prisma.staff.deleteMany({
          where: { salonId: salon.id },
        });

        await this.prisma.service.deleteMany({
          where: { salonId: salon.id },
        });

        // Удаляем сам салон
        await this.prisma.salon.delete({
          where: { id: salon.id },
        });
      }

      // Удаляем все бронирования пользователя
      if (user.bookings.length > 0) {
        console.log(`📅 Deleting ${user.bookings.length} bookings`);
        await this.prisma.booking.deleteMany({
          where: { userId: userId },
        });
      }

      // Удаляем все отзывы пользователя
      if (user.reviews.length > 0) {
        console.log(`⭐ Deleting ${user.reviews.length} reviews`);
        await this.prisma.review.deleteMany({
          where: { userId: userId },
        });
      }

      // Удаляем самого пользователя
      console.log(`👤 Deleting user: ${userId}`);
      await this.prisma.user.delete({
        where: { id: userId },
      });

      // Удаляем пользователя из Supabase Auth
      try {
        console.log(`🔐 Deleting user from Supabase Auth: ${userId}`);
        const { error } = await supabase.auth.admin.deleteUser(userId);
        if (error) {
          console.warn(
            '⚠️ Failed to delete user from Supabase Auth:',
            error.message,
          );
          // Не выбрасываем ошибку, так как основное удаление уже выполнено
        }
      } catch (supabaseError) {
        console.warn(
          '⚠️ Supabase Auth deletion failed:',
          supabaseError.message,
        );
        // Не выбрасываем ошибку, так как основное удаление уже выполнено
      }

      console.log(`✅ Account deletion completed for user: ${userId}`);

      return {
        userId,
        email: user.email,
        role: user.role,
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `❌ Account deletion failed for user ${userId}:`,
        error.message,
      );
      throw new Error(`Failed to delete account: ${error.message}`);
    }
  }
}
