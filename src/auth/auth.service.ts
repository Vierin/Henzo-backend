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
    phone?: string;
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
          phone: data.phone,
          role: (data.role as 'OWNER' | 'CLIENT' | 'ADMIN') || 'CLIENT',
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

      // Если пользователь не найден в базе данных, но существует в Supabase Auth,
      // создаем его автоматически с ролью из метаданных или CLIENT по умолчанию
      if (!dbUser) {
        console.log('⚠️ User not found in database, creating automatically...');
        try {
          // Всегда создаем пользователя с ролью CLIENT по умолчанию
          // Роль будет обновлена через PATCH запрос из frontend
          const userRole = 'CLIENT';

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
}
