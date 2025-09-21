import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { supabase } from '../lib/supabase';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  async registerClient(data: {
    email: string;
    password: string;
    name?: string;
    phone?: string;
  }) {
    try {
      // Проверяем, существует ли пользователь в нашей базе данных
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Создаем пользователя в Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

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
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header provided');
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify the token with Supabase
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error) {
        throw new Error('Invalid token');
      }

      if (!user) {
        throw new Error('User not found');
      }

      // Get user data from our database
      const dbUser = await this.prisma.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser) {
        throw new Error('User not found in database');
      }

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
}
