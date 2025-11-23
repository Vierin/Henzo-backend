import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { supabase } from '../lib/supabase';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { nanoid } from 'nanoid';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async registerOwner(data: {
    userId: string | null;
    email: string;
    password?: string;
    name?: string;
    role?: string;
    magicLinkToken?: string;
  }) {
    try {
      // Проверяем magic link token
      let emailConfirmed = false;
      if (data.magicLinkToken) {
        const pendingReg =
          await this.prisma.pendingBusinessRegistration.findFirst({
            where: {
              token: data.magicLinkToken,
              email: data.email.toLowerCase().trim(),
              expiresAt: {
                gt: new Date(),
              },
            },
          });

        if (!pendingReg) {
          throw new BadRequestException('Invalid or expired magic link');
        }

        emailConfirmed = true;
        // Удаляем использованный токен
        await this.prisma.pendingBusinessRegistration.delete({
          where: { id: pendingReg.id },
        });
      }

      let userId = data.userId;
      // emailConfirmed уже установлен выше если есть magicLinkToken

      // Если регистрация из magic link и userId null, создаем пользователя через Admin API
      if (emailConfirmed && !userId && data.password) {
        try {
          console.log(
            '✅ Creating user with confirmed email via Admin API for magic link registration',
          );

          // Создаем пользователя через Admin API с уже подтвержденным email
          // Роль устанавливаем в app_metadata (включается в JWT токен)
          const { data: adminUser, error: adminError } =
            await supabase.auth.admin.createUser({
              email: data.email,
              password: data.password,
              email_confirm: true, // Сразу подтверждаем email
              user_metadata: {
                name: data.name,
              },
              app_metadata: {
                role: 'OWNER', // Роль в app_metadata включается в JWT
              },
            });

          if (adminError) {
            console.error(
              '❌ Failed to create user via Admin API:',
              adminError,
            );

            // Проверяем тип ошибки для более понятных сообщений
            if (adminError.message?.includes('already been registered')) {
              throw new BadRequestException(
                'A user with this email address has already been registered. Please try logging in instead.',
              );
            }

            throw new BadRequestException(
              adminError.message || 'Failed to create user account',
            );
          }

          if (adminUser.user) {
            console.log('✅ User created with confirmed email:', data.email);
            userId = adminUser.user.id;
            emailConfirmed = true;
          }
        } catch (error) {
          console.error('❌ Error creating user via Admin API:', error);
          throw error;
        }
      } else if (userId) {
        // Проверяем, существует ли пользователь в нашей базе данных
        const existingUser = await this.prisma.user.findUnique({
          where: { id: userId },
        });

        if (existingUser) {
          throw new Error('User already exists in database');
        }

        // Обычная регистрация - пробуем подтвердить существующего пользователя
        emailConfirmed = await this.confirmExistingUser(userId);
      } else {
        throw new Error('UserId is required for non-invite registrations');
      }

      // Проверяем что userId определен
      if (!userId) {
        throw new Error('Failed to get user ID');
      }

      // Создаем запись пользователя в нашей базе данных
      const user = await this.prisma.user.create({
        data: {
          id: userId, // Используем обновленный userId
          email: data.email,
          name: data.name,
          role: (data.role as 'OWNER' | 'CLIENT' | 'ADMIN') || 'OWNER',
        },
      });

      // Синхронизируем роль в app_metadata Supabase (если еще не установлена)
      // Это гарантирует, что роль будет в JWT токене
      try {
        const { data: existingUser } =
          await supabase.auth.admin.getUserById(userId);
        const currentRole =
          existingUser?.user?.app_metadata?.role ||
          existingUser?.user?.user_metadata?.role;

        if (currentRole !== user.role) {
          await supabase.auth.admin.updateUserById(userId, {
            app_metadata: {
              role: user.role,
            },
          });
          console.log(`✅ Role synced to app_metadata for user ${userId}`);
        }
      } catch (error) {
        console.error('⚠️ Failed to sync role to app_metadata:', error);
        // Не блокируем регистрацию, если не удалось обновить метаданные
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
        },
        emailConfirmed,
      };
    } catch (error) {
      throw new Error(`Owner registration failed: ${error.message}`);
    }
  }

  private async confirmExistingUser(userId: string): Promise<boolean> {
    try {
      // Пытаемся с несколькими попытками вместо большой задержки
      let retries = 3;
      let existingAuthUser: any = null;
      let getUserError: any = null;

      while (retries > 0) {
        const result = await supabase.auth.admin.getUserById(userId);
        existingAuthUser = result.data?.user;
        getUserError = result.error;

        if (existingAuthUser) break;

        // Короткая задержка перед повторной попыткой (200ms вместо 1500ms)
        await new Promise((resolve) => setTimeout(resolve, 200));
        retries--;
      }

      if (getUserError || !existingAuthUser) {
        console.error(
          '❌ User not found in Supabase after retries:',
          getUserError,
        );
        return false;
      }

      // Пользователь существует, подтверждаем email
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          email_confirm: true,
        },
      );

      if (updateError) {
        console.error('❌ Failed to confirm email:', updateError);
        return false;
      }

      console.log('✅ Email confirmed successfully for userId:', userId);
      return true;
    } catch (error) {
      console.error('❌ Error confirming existing user:', error);
      return false;
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

      // Синхронизируем роль в app_metadata Supabase
      // Это гарантирует, что роль будет в JWT токене
      try {
        await supabase.auth.admin.updateUserById(authData.user.id, {
          app_metadata: {
            role: 'CLIENT',
          },
        });
        console.log(
          `✅ Role synced to app_metadata for client ${authData.user.id}`,
        );
      } catch (error) {
        console.error('⚠️ Failed to sync role to app_metadata:', error);
        // Не блокируем регистрацию, если не удалось обновить метаданные
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

      // Синхронизируем роль в app_metadata если она есть в БД, но отсутствует в JWT
      // Это гарантирует, что роль будет доступна в следующих запросах
      if (dbUser) {
        const currentRole = user.app_metadata?.role || user.user_metadata?.role;
        if (currentRole !== dbUser.role) {
          try {
            await supabase.auth.admin.updateUserById(user.id, {
              app_metadata: {
                role: dbUser.role,
              },
            });
            console.log(
              `✅ Role synced to app_metadata for user ${user.id}: ${dbUser.role}`,
            );
          } catch (error) {
            console.error('⚠️ Failed to sync role to app_metadata:', error);
          }
        }
      }

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
      // Используем upsert для избежания race conditions
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

          // Проверяем, не существует ли пользователь с таким email (для Google OAuth случаев)
          const existingUserByEmail = user.email
            ? await this.prisma.user.findUnique({
                where: { email: user.email },
              })
            : null;

          if (existingUserByEmail && existingUserByEmail.id !== user.id) {
            // Пользователь с таким email уже существует, но с другим ID
            // Это может быть случай, когда пользователь регистрировался через email, а потом логинился через Google
            console.log(
              '⚠️ User with same email exists but different ID, updating ID...',
            );
            // Обновляем ID существующего пользователя на новый из Supabase Auth
            await this.prisma.$transaction(async (prisma) => {
              // Update salons
              await prisma.salon.updateMany({
                where: { ownerId: existingUserByEmail.id },
                data: { ownerId: user.id },
              });

              // Update bookings
              await prisma.booking.updateMany({
                where: { userId: existingUserByEmail.id },
                data: { userId: user.id },
              });

              // Update reviews
              await prisma.review.updateMany({
                where: { userId: existingUserByEmail.id },
                data: { userId: user.id },
              });

              // Update user ID
              await prisma.user.update({
                where: { id: existingUserByEmail.id },
                data: { id: user.id },
              });
            });

            // Get updated user
            dbUser = await this.prisma.user.findUnique({
              where: { id: user.id },
            });
          } else {
            // Используем upsert вместо create для избежания ошибок при race conditions
            dbUser = await this.prisma.user.upsert({
              where: { id: user.id },
              update: {
                // Обновляем только если данные изменились
                email: user.email || '',
                name:
                  user.user_metadata?.name ||
                  user.user_metadata?.full_name ||
                  null,
                phone: user.user_metadata?.phone || null,
              },
              create: {
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
          }

          if (dbUser) {
            console.log(
              `✅ User created/updated automatically in database with role ${dbUser.role}:`,
              dbUser.id,
            );
          } else {
            throw new Error('Failed to create or retrieve user from database');
          }
        } catch (createError: any) {
          console.error(
            '❌ Failed to create/update user in database:',
            createError.message,
            createError.code,
          );
          // Если ошибка из-за уникальности, пытаемся получить пользователя еще раз
          if (
            createError.message?.includes('Unique constraint') ||
            createError.code === 'P2002'
          ) {
            // Try to find by email first
            if (user.email) {
              dbUser = await this.prisma.user.findUnique({
                where: { email: user.email },
              });
            }
            // If still not found, try by ID
            if (!dbUser) {
              dbUser = await this.prisma.user.findUnique({
                where: { id: user.id },
              });
            }
            if (dbUser) {
              console.log(
                '✅ User found after unique constraint error:',
                dbUser.id,
              );
            } else {
              console.error('❌ User not found after unique constraint error');
              throw new Error(
                `Failed to create user in database: ${createError.message}`,
              );
            }
          } else {
            throw new Error(
              `Failed to create user in database: ${createError.message}`,
            );
          }
        }
      }

      if (!dbUser) {
        console.error('❌ User not found in database after all attempts');
        throw new Error('User not found in database');
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
    } catch (error: any) {
      console.error('❌ Error in getCurrentUser:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      throw new Error(
        `Failed to get user: ${error.message || 'Unknown error'}`,
      );
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
      // Обновляем роль в базе данных
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

      // Синхронизируем роль в app_metadata Supabase
      // Это гарантирует, что роль будет в JWT токене для следующих запросов
      try {
        await supabase.auth.admin.updateUserById(userId, {
          app_metadata: {
            role: role,
          },
        });
        console.log(
          `✅ Role synced to app_metadata for user ${userId}: ${role}`,
        );
      } catch (error) {
        console.error('⚠️ Failed to sync role to app_metadata:', error);
        // Не блокируем обновление, если не удалось синхронизировать метаданные
      }

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

      // Используем upsert для избежания ошибок при race conditions
      const newUser = await this.prisma.user.upsert({
        where: { id: user.id },
        update: {
          // Обновляем данные если пользователь уже существует
          email: user.email || '',
          name:
            user.user_metadata?.name || user.user_metadata?.full_name || null,
          phone: user.user_metadata?.phone || null,
        },
        create: {
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
          Salon: true,
          Booking: true,
          Review: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      console.log(`📊 User data to delete:`, {
        userId: user.id,
        email: user.email,
        role: user.role,
        hasSalon: !!user.Salon && user.Salon.length > 0,
        bookingsCount: user.Booking.length,
        reviewsCount: user.Review.length,
      });

      // Удаляем связанные данные в зависимости от роли
      if (user.role === 'OWNER' && user.Salon && user.Salon.length > 0) {
        const salon = user.Salon[0];
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
      if (user.Booking.length > 0) {
        console.log(`📅 Deleting ${user.Booking.length} bookings`);
        await this.prisma.booking.deleteMany({
          where: { userId: userId },
        });
      }

      // Удаляем все отзывы пользователя
      if (user.Review.length > 0) {
        console.log(`⭐ Deleting ${user.Review.length} reviews`);
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

  async getFavoriteSalons(userId: string) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { favoriteSalons: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Get full salon data for favorite salon IDs
      const salons = await this.prisma.salon.findMany({
        where: {
          id: {
            in: user.favoriteSalons,
          },
        },
        include: {
          Service: {
            select: {
              id: true,
              name: true,
              price: true,
              duration: true,
            },
          },
          Review: {
            select: {
              id: true,
              rating: true,
            },
          },
        },
      });

      // Calculate average rating for each salon
      const salonsWithRating = salons.map((salon) => {
        const avgRating =
          salon.Review.length > 0
            ? salon.Review.reduce((sum, review) => sum + review.rating, 0) /
              salon.Review.length
            : 0;

        return {
          ...salon,
          averageRating: avgRating,
          reviewCount: salon.Review.length,
        };
      });

      return salonsWithRating;
    } catch (error) {
      throw new Error(`Failed to get favorite salons: ${error.message}`);
    }
  }

  async addFavoriteSalon(userId: string, salonId: string) {
    try {
      // Check if salon exists
      const salon = await this.prisma.salon.findUnique({
        where: { id: salonId },
      });

      if (!salon) {
        throw new Error('Salon not found');
      }

      // Get current user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { favoriteSalons: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Check if already favorited
      if (user.favoriteSalons.includes(salonId)) {
        throw new Error('Salon is already in favorites');
      }

      // Add salon to favorites
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          favoriteSalons: {
            push: salonId,
          },
        },
      });

      return updatedUser;
    } catch (error) {
      throw new Error(`Failed to add salon to favorites: ${error.message}`);
    }
  }

  async removeFavoriteSalon(userId: string, salonId: string) {
    try {
      // Get current user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { favoriteSalons: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Remove salon from favorites
      const updatedFavorites = user.favoriteSalons.filter(
        (id) => id !== salonId,
      );

      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          favoriteSalons: updatedFavorites,
        },
      });

      return updatedUser;
    } catch (error) {
      throw new Error(
        `Failed to remove salon from favorites: ${error.message}`,
      );
    }
  }

  async authenticateWithTelegram(data: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
    auth_date: number;
    hash: string;
  }) {
    try {
      // Проверяем подлинность данных от Telegram
      const isValid = this.validateTelegramAuth(data);
      if (!isValid) {
        throw new BadRequestException('Invalid Telegram authentication data');
      }

      // Проверяем, не устарели ли данные (не более 24 часов)
      const currentTime = Math.floor(Date.now() / 1000);
      if (currentTime - data.auth_date > 86400) {
        throw new BadRequestException('Telegram authentication data expired');
      }

      // Формируем email из Telegram данных (если нет username, используем id)
      const email = data.username
        ? `${data.username}@telegram.local`
        : `telegram_${data.id}@telegram.local`;

      // Формируем имя
      const name = data.last_name
        ? `${data.first_name} ${data.last_name}`
        : data.first_name;

      // Ищем существующего пользователя по Telegram ID
      let dbUser = await this.prisma.user.findFirst({
        where: {
          OR: [{ email }, { telegramId: data.id.toString() }],
        },
      });

      let supabaseUser;

      if (dbUser) {
        // Пользователь существует, получаем его из Supabase
        const { data: userData, error: userError } =
          await supabase.auth.admin.getUserById(dbUser.id);

        if (userError || !userData.user) {
          throw new BadRequestException('User not found in Supabase');
        }

        supabaseUser = userData.user;

        // Обновляем данные пользователя из Telegram
        dbUser = await this.prisma.user.update({
          where: { id: dbUser.id },
          data: {
            name,
            telegramId: data.id.toString(),
            telegramUsername: data.username,
            telegramPhotoUrl: data.photo_url,
          },
        });
      } else {
        // Создаем нового пользователя
        // Генерируем случайный пароль (пользователь не будет его использовать)
        const randomPassword = crypto.randomBytes(32).toString('hex');

        const { data: adminUser, error: adminError } =
          await supabase.auth.admin.createUser({
            email,
            password: randomPassword,
            email_confirm: true,
            user_metadata: {
              name,
            },
            app_metadata: {
              role: 'CLIENT', // Роль в app_metadata включается в JWT
            },
          });

        if (adminError || !adminUser.user) {
          throw new BadRequestException(
            adminError?.message || 'Failed to create user',
          );
        }

        supabaseUser = adminUser.user;

        // Используем upsert для избежания ошибок при race conditions
        dbUser = await this.prisma.user.upsert({
          where: { id: supabaseUser.id },
          update: {
            // Обновляем данные если пользователь уже существует
            email,
            name,
            telegramId: data.id.toString(),
            telegramUsername: data.username,
            telegramPhotoUrl: data.photo_url,
          },
          create: {
            id: supabaseUser.id,
            email,
            name,
            role: 'CLIENT',
            telegramId: data.id.toString(),
            telegramUsername: data.username,
            telegramPhotoUrl: data.photo_url,
          },
        });
      }

      // Создаем сессию для пользователя
      // Генерируем временный пароль и создаем сессию
      const tempPassword = crypto.randomBytes(32).toString('hex');

      // Обновляем пароль пользователя
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        supabaseUser.id,
        {
          password: tempPassword,
        },
      );

      if (updateError) {
        throw new BadRequestException('Failed to update user password');
      }

      // Создаем новый клиент Supabase с anon key для входа
      const { createClient } = require('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new BadRequestException('Supabase configuration missing');
      }

      const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

      // Входим с временным паролем
      const { data: signInData, error: signInError } =
        await publicSupabase.auth.signInWithPassword({
          email: supabaseUser.email!,
          password: tempPassword,
        });

      if (signInError || !signInData.session) {
        throw new BadRequestException(
          signInError?.message || 'Failed to create session',
        );
      }

      return {
        success: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          role: dbUser.role,
        },
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        },
      };
    } catch (error) {
      console.error('❌ Telegram authentication error:', error);
      throw error;
    }
  }

  private validateTelegramAuth(data: {
    id: number;
    first_name: string;
    auth_date: number;
    hash: string;
  }): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.warn('TELEGRAM_BOT_TOKEN not set, skipping validation');
      return true; // В режиме разработки пропускаем валидацию
    }

    try {
      // Создаем строку для проверки
      const dataCheckString = Object.keys(data)
        .filter((key) => key !== 'hash')
        .sort()
        .map((key) => `${key}=${data[key as keyof typeof data]}`)
        .join('\n');

      // Создаем секретный ключ
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

      // Вычисляем hash
      const calculatedHash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return calculatedHash === data.hash;
    } catch (error) {
      console.error('Error validating Telegram auth:', error);
      return false;
    }
  }

  async sendBusinessMagicLink(email: string, name: string) {
    try {
      // Проверяем, не существует ли уже пользователь с этим email
      const existingUser = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (existingUser) {
        throw new BadRequestException(
          'User with this email already exists. Please login instead.',
        );
      }

      // Удаляем старые pending registrations для этого email
      await this.prisma.pendingBusinessRegistration.deleteMany({
        where: {
          email: email.toLowerCase().trim(),
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      // Генерируем токен
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Сохраняем pending registration
      const pendingReg = await this.prisma.pendingBusinessRegistration.create({
        data: {
          token,
          email: email.toLowerCase().trim(),
          name,
          expiresAt,
        },
      });

      // Генерируем URL для регистрации
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';
      const registerUrl = `${frontendUrl}/business/register?email=${encodeURIComponent(email)}&token=${token}&name=${encodeURIComponent(name)}`;

      // Отправляем email
      await this.emailService.sendBusinessRegistrationMagicLink(
        email,
        name,
        registerUrl,
      );

      console.log('✅ Business magic link sent:', { email });
      return { success: true, token: pendingReg.id };
    } catch (error) {
      console.error('❌ Error sending business magic link:', error);
      throw error;
    }
  }
}
