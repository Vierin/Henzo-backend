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
  // Cache for getCurrentUser to prevent duplicate calls
  private getCurrentUserCache = new Map<
    string,
    { result: any; timestamp: number }
  >();
  private readonly CACHE_TTL = 1000; // 1 second cache

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
      console.log('🔐 registerOwner called with:', {
        userId: data.userId,
        email: data.email,
        hasPassword: !!data.password,
        hasMagicLinkToken: !!data.magicLinkToken,
        role: data.role,
      });

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
          // Пользователь уже существует - обновляем роль на OWNER если нужно
          // Для бизнес-регистрации всегда устанавливаем OWNER
          const targetRole =
            (data.role as 'OWNER' | 'CLIENT' | 'ADMIN') || 'OWNER';

          if (existingUser.role !== targetRole) {
            console.log(
              `🔄 Updating user role from ${existingUser.role} to ${targetRole}`,
            );
            const updatedUser = await this.prisma.user.update({
              where: { id: userId },
              data: {
                role: targetRole,
                name: data.name || existingUser.name,
                email: data.email || existingUser.email,
              },
            });

            // Синхронизируем роль в app_metadata
            try {
              await supabase.auth.admin.updateUserById(userId, {
                app_metadata: {
                  role: targetRole,
                },
              });
              console.log(
                `✅ Role updated to ${targetRole} for user ${userId}`,
              );
            } catch (error) {
              console.error('⚠️ Failed to sync role to app_metadata:', error);
            }

            return {
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                phone: updatedUser.phone,
                role: updatedUser.role,
              },
              emailConfirmed: true,
            };
          }

          // Пользователь уже имеет нужную роль - но все равно синхронизируем в app_metadata
          console.log(
            `ℹ️ User already has role ${existingUser.role}, syncing to app_metadata`,
          );

          // Синхронизируем роль в app_metadata даже если она уже правильная
          // Это гарантирует, что роль будет в JWT токене
          try {
            await supabase.auth.admin.updateUserById(userId, {
              app_metadata: {
                role: targetRole,
              },
            });
            console.log(
              `✅ Role synced to app_metadata for user ${userId}: ${targetRole}`,
            );
          } catch (error) {
            console.error('⚠️ Failed to sync role to app_metadata:', error);
          }

          return {
            user: {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name,
              phone: existingUser.phone,
              role: existingUser.role,
            },
            emailConfirmed: true,
          };
        }

        // Для OAuth регистрации email уже подтвержден
        // Проверяем статус подтверждения email в Supabase
        try {
          const { data: authUser } =
            await supabase.auth.admin.getUserById(userId);
          emailConfirmed = authUser?.user?.email_confirmed_at !== null;
          console.log(
            `📧 Email confirmed status for user ${userId}:`,
            emailConfirmed,
          );
        } catch (error) {
          console.error('⚠️ Failed to check email confirmation status:', error);
          // Для OAuth предполагаем, что email подтвержден
          emailConfirmed = true;
        }
      } else {
        throw new Error('UserId is required for non-invite registrations');
      }

      // Проверяем что userId определен
      if (!userId) {
        console.error('❌ userId is null or undefined');
        throw new Error('Failed to get user ID');
      }

      console.log('✅ userId confirmed:', userId);

      // Используем upsert для избежания ошибок при race conditions
      // (например, если getCurrentUser уже создал пользователя)
      console.log('📝 Creating/updating user in database...');
      try {
        const user = await this.prisma.user.upsert({
          where: { id: userId },
          update: {
            // Обновляем роль на OWNER если нужно (для бизнес-регистрации)
            role: (data.role as 'OWNER' | 'CLIENT' | 'ADMIN') || 'OWNER',
            email: data.email || undefined,
            name: data.name || undefined,
          },
          create: {
            id: userId,
            email: data.email,
            name: data.name,
            role: (data.role as 'OWNER' | 'CLIENT' | 'ADMIN') || 'OWNER',
          },
        });

        console.log('✅ User created/updated in database:', {
          id: user.id,
          email: user.email,
          role: user.role,
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
            console.log(
              `✅ Role synced to app_metadata for user ${userId}: ${user.role}`,
            );
          } else {
            console.log(
              `ℹ️ Role already set in app_metadata for user ${userId}: ${user.role}`,
            );
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
      } catch (upsertError: any) {
        console.error('❌ Error in user upsert:', {
          message: upsertError.message,
          code: upsertError.code,
          meta: upsertError.meta,
        });

        // Если ошибка из-за уникальности, пытаемся получить пользователя
        if (
          upsertError.code === 'P2002' ||
          upsertError.message?.includes('Unique constraint')
        ) {
          console.log(
            '⚠️ Unique constraint error, trying to find existing user...',
          );
          const existingUser = await this.prisma.user.findUnique({
            where: { id: userId },
          });

          if (existingUser) {
            // Обновляем роль на OWNER
            const updatedUser = await this.prisma.user.update({
              where: { id: userId },
              data: {
                role: (data.role as 'OWNER' | 'CLIENT' | 'ADMIN') || 'OWNER',
              },
            });

            // Синхронизируем роль в app_metadata
            try {
              await supabase.auth.admin.updateUserById(userId, {
                app_metadata: {
                  role: updatedUser.role,
                },
              });
              console.log(`✅ Role updated and synced for user ${userId}`);
            } catch (error) {
              console.error('⚠️ Failed to sync role to app_metadata:', error);
            }

            return {
              user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                phone: updatedUser.phone,
                role: updatedUser.role,
              },
              emailConfirmed: true,
            };
          }
        }

        throw upsertError;
      }
    } catch (error: any) {
      console.error('❌ registerOwner error:', {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
        data: {
          userId: data.userId,
          email: data.email,
          hasPassword: !!data.password,
        },
      });
      throw new Error(
        `Owner registration failed: ${error.message || 'Unknown error'}`,
      );
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
        // Если пользователь уже есть и это не клиент — блокируем регистрацию
        if (existingUser.role !== 'CLIENT') {
          console.log(
            '❌ User with this email exists but is not a client:',
            data.email,
          );
          throw new Error('User with this email already exists');
        }

        // Вариант 3: "апгрейд" гостевого клиента до полноценного аккаунта
        if (existingUser.isGuest) {
          console.log(
            '🔁 Upgrading guest client user to full account:',
            data.email,
          );

          // Email уже подтвержден при подтверждении бронирования через magic link
          // Используем Admin API для создания пользователя с уже подтвержденным email
          console.log(
            '📧 Creating user in Supabase with confirmed email via Admin API (email already verified via booking confirmation)...',
          );
          const { data: authData, error: authError } =
            await supabase.auth.admin.createUser({
              email: data.email,
              password: data.password,
              email_confirm: true, // Email уже подтвержден при подтверждении бронирования
              user_metadata: {
                name: data.name,
                phone: data.phone,
              },
              app_metadata: {
                role: 'CLIENT',
              },
            });

          if (authError) {
            console.error(
              '❌ Supabase auth error while upgrading guest client:',
              authError.message,
            );

            // Если пользователь уже существует в Supabase, пытаемся войти
            if (
              authError.message?.includes('already been registered') ||
              authError.message?.includes('already exists')
            ) {
              console.log(
                '⚠️ User already exists in Supabase, attempting to sign in...',
              );

              const { data: signInData, error: signInError } =
                await supabase.auth.signInWithPassword({
                  email: data.email,
                  password: data.password,
                });

              if (signInError) {
                throw new Error(
                  'User already exists. Please use login instead.',
                );
              }

              // Обновляем данные существующего пользователя в нашей БД
              const user = await this.prisma.user.update({
                where: { email: data.email },
                data: {
                  name: data.name ?? existingUser.name,
                  phone: data.phone ?? existingUser.phone,
                  role: 'CLIENT',
                  isGuest: false,
                  id: signInData.user.id, // Обновляем ID если он изменился
                },
              });

              // Синхронизируем роль в app_metadata Supabase
              try {
                await supabase.auth.admin.updateUserById(signInData.user.id, {
                  app_metadata: {
                    role: 'CLIENT',
                  },
                });
                console.log(
                  `✅ Role synced to app_metadata for upgraded client ${signInData.user.id}`,
                );
              } catch (error) {
                console.error(
                  '⚠️ Failed to sync role to app_metadata for upgraded client:',
                  error,
                );
              }

              return {
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  phone: user.phone,
                  role: user.role,
                },
                session: signInData.session,
                emailConfirmed: true, // Email уже подтвержден при подтверждении бронирования
              };
            }

            throw new Error(authError.message);
          }

          if (!authData.user) {
            console.error(
              '❌ No user data returned from Supabase while upgrading guest client',
            );
            throw new Error('Failed to create user');
          }

          console.log(
            '✅ Guest client user created in Supabase with confirmed email:',
            authData.user.id,
          );

          // Обновляем данные существующего пользователя в нашей БД
          const user = await this.prisma.user.update({
            where: { email: data.email },
            data: {
              name: data.name ?? existingUser.name,
              phone: data.phone ?? existingUser.phone,
              role: 'CLIENT',
              isGuest: false,
            },
          });

          // Синхронизируем роль в app_metadata Supabase
          try {
            await supabase.auth.admin.updateUserById(authData.user.id, {
              app_metadata: {
                role: 'CLIENT',
              },
            });
            console.log(
              `✅ Role synced to app_metadata for upgraded client ${authData.user.id}`,
            );
          } catch (error) {
            console.error(
              '⚠️ Failed to sync role to app_metadata for upgraded client:',
              error,
            );
          }

          // Admin API не возвращает session, нужно войти для получения сессии
          const { data: signInData, error: signInError } =
            await supabase.auth.signInWithPassword({
              email: data.email,
              password: data.password,
            });

          if (signInError || !signInData.session) {
            console.warn(
              '⚠️ Could not create session after user creation, but user was created successfully',
            );
            // Возвращаем без сессии - фронтенд может попросить пользователя войти
            return {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                role: user.role,
              },
              session: null,
              emailConfirmed: true, // Email уже подтвержден при подтверждении бронирования
            };
          }

          return {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone,
              role: user.role,
            },
            session: signInData.session,
            emailConfirmed: true, // Email уже подтвержден при подтверждении бронирования
          };
        }

        // Если пользователь уже существует и не является гостем-клиентом —
        // считаем, что аккаунт уже полностью зарегистрирован.
        console.log('❌ User already exists as full client:', data.email);
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
      // Используем email как стабильный идентификатор между Supabase и нашей БД
      const user = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
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

      // Check cache to prevent duplicate calls
      const cacheKey = token.substring(0, 20); // Use first 20 chars as cache key
      const cached = this.getCurrentUserCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        console.log('✅ Using cached getCurrentUser result');
        return cached.result;
      }

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
      // IMPORTANT: we use email as the stable link between Supabase and our DB,
      // because some users (e.g. guests created via bookings) may have been
      // created before a Supabase account existed.
      console.log('🔍 Looking up user in database...');
      if (!user.email) {
        throw new Error('User email is missing');
      }
      let dbUser = await this.prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
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
          // Проверяем роль в app_metadata Supabase (устанавливается при регистрации)
          const roleFromMetadata =
            user.app_metadata?.role || user.user_metadata?.role;

          // Проверяем, есть ли у пользователя салоны (для восстановления роли OWNER)
          const existingSalons = await this.prisma.salon.findMany({
            where: { ownerId: user.id },
          });

          // Определяем роль: сначала из метаданных, потом из салонов, потом CLIENT по умолчанию
          const userRole =
            roleFromMetadata ||
            (existingSalons.length > 0 ? 'OWNER' : 'CLIENT');

          console.log('📝 Creating user with role:', {
            roleFromMetadata,
            hasSalons: existingSalons.length > 0,
            finalRole: userRole,
            userId: user.id,
            email: user.email,
          });

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
            // НЕ обновляем роль в update, только при создании - чтобы не перезаписать роль, установленную через registerOwner
            dbUser = await this.prisma.user.upsert({
              where: { id: user.id },
              update: {
                // Обновляем только данные, но НЕ роль - роль может быть уже установлена через registerOwner
                email: user.email || undefined,
                name:
                  user.user_metadata?.name ||
                  user.user_metadata?.full_name ||
                  undefined,
                phone: user.user_metadata?.phone || undefined,
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

            // Если пользователь уже существовал, проверяем и обновляем роль из app_metadata если нужно
            if (
              dbUser &&
              roleFromMetadata &&
              dbUser.role !== roleFromMetadata
            ) {
              console.log(
                `🔄 Updating existing user role from ${dbUser.role} to ${roleFromMetadata} based on app_metadata`,
              );
              dbUser = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                  role: roleFromMetadata as 'CLIENT' | 'OWNER' | 'ADMIN',
                },
              });
            }
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

      const result = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.name,
          phone: dbUser.phone,
          role: dbUser.role,
        },
      };

      // Cache the result (use same cacheKey as defined earlier)
      this.getCurrentUserCache.set(cacheKey, {
        result,
        timestamp: Date.now(),
      });

      // Clean up old cache entries
      for (const [key, value] of this.getCurrentUserCache.entries()) {
        if (Date.now() - value.timestamp > this.CACHE_TTL * 2) {
          this.getCurrentUserCache.delete(key);
        }
      }

      return result;
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
        console.log(`Deleting ${user.Booking.length} bookings`);
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

      // Критично: Используем select вместо include для уменьшения payload
      const salons = await this.prisma.salon.findMany({
        where: {
          id: {
            in: user.favoriteSalons,
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          address: true,
          phone: true,
          email: true,
          website: true,
          instagram: true,
          photos: true,
          // Убираем workingHours, reminderSettings, ownerId, createdAt, categoryIds, latitude, longitude - не нужны для списка
          Service: {
            select: {
              id: true,
              name: true,
              price: true,
              duration: true,
              // Убираем description, serviceCategoryId, serviceGroupId - не нужны для списка
            },
          },
          Review: {
            select: {
              id: true,
              rating: true,
              // Убираем comment, createdAt - не нужны для расчета рейтинга
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

  async sendBusinessMagicLink(email: string, name: string, password: string) {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      console.log('🔍 Checking for existing user with email:', normalizedEmail);

      // Проверяем, не существует ли уже бизнес-аккаунт (OWNER) с этим email в нашей БД
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        console.log('❌ User found in database:', {
          email: existingUser.email,
          role: existingUser.role,
          id: existingUser.id,
        });

        // Если пользователь существует и это OWNER, не отправляем magic link
        if (existingUser.role === 'OWNER') {
          throw new BadRequestException(
            'A business account with this email already exists. Please login instead.',
          );
        }
        // Если пользователь существует, но это CLIENT, тоже не отправляем
        // (чтобы избежать конфликтов и путаницы)
        throw new BadRequestException(
          'An account with this email already exists. Please login instead.',
        );
      }

      // Также проверяем в Supabase Auth (пользователь может существовать там, но не в нашей БД)
      console.log(
        '🔍 Checking Supabase Auth for user with email:',
        normalizedEmail,
      );

      let existingSupabaseUser: any = null;
      let page = 1;
      const perPage = 1000;
      let hasMore = true;
      let foundError = false;

      // Используем пагинацию для поиска пользователя в Supabase
      while (hasMore && !foundError) {
        const {
          data: { users },
          error: listError,
        } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

        if (listError) {
          console.error(
            '⚠️ Error listing users from Supabase (page ' + page + '):',
            listError.message,
          );
          foundError = true;
          // Не прерываем выполнение, но логируем ошибку
          // Продолжаем, чтобы проверить хотя бы первую страницу
          break;
        }

        if (!users || users.length === 0) {
          hasMore = false;
          break;
        }

        // Ищем пользователя с нужным email на текущей странице
        const foundUser = users.find(
          (user: any) => user.email?.toLowerCase().trim() === normalizedEmail,
        );

        if (foundUser) {
          existingSupabaseUser = foundUser;
          hasMore = false; // Нашли, можно прекращать поиск
          break;
        }

        // Если получили меньше пользователей, чем запросили, значит это последняя страница
        if (users.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }

      if (existingSupabaseUser) {
        console.log('❌ User found in Supabase Auth:', {
          email: existingSupabaseUser.email,
          id: existingSupabaseUser.id,
          role:
            existingSupabaseUser.user_metadata?.role ||
            existingSupabaseUser.app_metadata?.role,
          emailConfirmed: !!existingSupabaseUser.email_confirmed_at,
        });

        // Проверяем роль в метаданных Supabase
        const userRole =
          existingSupabaseUser.user_metadata?.role ||
          existingSupabaseUser.app_metadata?.role;

        // Если это OWNER или ADMIN, не отправляем
        if (userRole === 'OWNER' || userRole === 'ADMIN') {
          throw new BadRequestException(
            'A business account with this email already exists. Please login instead.',
          );
        }

        // Если пользователь существует в Supabase, но не в нашей БД,
        // это может быть незавершенная регистрация - тоже не отправляем
        throw new BadRequestException(
          'An account with this email already exists. Please login instead.',
        );
      }

      console.log('✅ No existing user found, proceeding with magic link');

      // Проверяем, нет ли активных pending registrations для этого email
      const activePendingReg =
        await this.prisma.pendingBusinessRegistration.findFirst({
          where: {
            email: normalizedEmail,
            expiresAt: {
              gt: new Date(), // Только не истекшие
            },
          },
        });

      if (activePendingReg) {
        console.log(
          '⚠️ Active pending registration found for email:',
          normalizedEmail,
        );
        // Можно либо удалить старую и создать новую, либо вернуть ошибку
        // Возвращаем ошибку, чтобы не спамить email
        throw new BadRequestException(
          'A registration link has already been sent to this email. Please check your inbox or wait before requesting again.',
        );
      }

      // Удаляем только истекшие pending registrations для этого email
      const deletedCount =
        await this.prisma.pendingBusinessRegistration.deleteMany({
          where: {
            email: normalizedEmail,
            expiresAt: {
              lt: new Date(),
            },
          },
        });

      if (deletedCount.count > 0) {
        console.log(
          `🗑️ Deleted ${deletedCount.count} expired pending registration(s) for email:`,
          normalizedEmail,
        );
      }

      // Создаем аккаунт сразу с неподтвержденным email
      console.log('📝 Creating business account with unconfirmed email...');
      const { data: authData, error: authError } =
        await supabase.auth.admin.createUser({
          email: normalizedEmail,
          password: password,
          email_confirm: false, // Email будет подтвержден при клике на magic link
          user_metadata: {
            name,
          },
          app_metadata: {
            role: 'OWNER',
          },
        });

      if (authError) {
        console.error('❌ Failed to create user in Supabase:', authError);
        throw new BadRequestException(
          authError.message || 'Failed to create account',
        );
      }

      if (!authData.user) {
        throw new BadRequestException('Failed to create user account');
      }

      console.log('✅ User created in Supabase:', authData.user.id);

      // Создаем запись пользователя в нашей БД
      const user = await this.prisma.user.create({
        data: {
          id: authData.user.id,
          email: normalizedEmail,
          name,
          role: 'OWNER',
        },
      });

      console.log('✅ User created in database:', user.id);

      // Генерируем токен для magic link
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Сохраняем pending registration (без пароля, так как аккаунт уже создан)
      // Используем userId вместо пароля для связи
      const pendingReg = await this.prisma.pendingBusinessRegistration.create({
        data: {
          token,
          email: normalizedEmail,
          name,
          password: authData.user.id, // Сохраняем userId вместо пароля для связи
          expiresAt,
        },
      });

      console.log('✅ Pending registration created:', {
        id: pendingReg.id,
        token: token.substring(0, 10) + '...',
        email: normalizedEmail,
        userId: authData.user.id,
        expiresAt,
      });

      // Генерируем URL для complete-setup (magic link ведет сразу на настройку салона)
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        (process.env.NODE_ENV === 'production' ? 'https://henzo.app' : 'http://localhost:3000');
      const completeSetupUrl = `${frontendUrl}/business/complete-setup?token=${token}`;

      console.log(
        '📧 Sending business registration magic link email to:',
        normalizedEmail,
      );
      console.log('🔗 Magic link URL:', completeSetupUrl);

      // Отправляем email
      await this.emailService.sendBusinessRegistrationMagicLink(
        email,
        name,
        completeSetupUrl,
      );

      console.log('✅ Business magic link sent:', { email });
      return { success: true, token: pendingReg.id };
    } catch (error) {
      console.error('❌ Error sending business magic link:', error);
      throw error;
    }
  }

  async verifyBusinessMagicLink(token: string) {
    try {
      console.log('🔍 Verifying business magic link with token:', token);
      
      // Находим pending registration
      const pendingReg =
        await this.prisma.pendingBusinessRegistration.findFirst({
          where: {
            token,
            expiresAt: {
              gt: new Date(),
            },
          },
        });

      if (!pendingReg) {
        console.log('❌ Pending registration not found for token:', token);
        // Проверяем, может токен истек или уже использован
        const expiredReg = await this.prisma.pendingBusinessRegistration.findFirst({
          where: { token },
        });
        if (expiredReg) {
          console.log('⚠️ Token found but expired or already used:', {
            token,
            expiresAt: expiredReg.expiresAt,
            now: new Date(),
            isExpired: expiredReg.expiresAt < new Date(),
          });
          throw new BadRequestException('Magic link has expired. Please request a new one.');
        }
        
        // Проверяем все токены для отладки
        const allPendingRegs = await this.prisma.pendingBusinessRegistration.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
        });
        console.log('📋 Recent pending registrations:', allPendingRegs.map(r => ({
          token: r.token.substring(0, 10) + '...',
          email: r.email,
          expiresAt: r.expiresAt,
        })));
        
        throw new BadRequestException('Invalid or expired magic link');
      }

      console.log('✅ Pending registration found:', {
        id: pendingReg.id,
        email: pendingReg.email,
        expiresAt: pendingReg.expiresAt,
      });

      // userId сохранен в поле password (временное решение)
      const userId = pendingReg.password;

      if (!userId) {
        throw new BadRequestException('Invalid magic link data');
      }

      // Подтверждаем email в Supabase
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        {
          email_confirm: true,
        },
      );

      if (updateError) {
        console.error('❌ Failed to confirm email:', updateError);
        throw new BadRequestException('Failed to confirm email');
      }

      console.log('✅ Email confirmed for user:', userId);

      // Получаем пользователя из нашей БД
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      // Генерируем magic link для автоматического логина
      const { data: linkData, error: linkError } =
        await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: user.email,
        });

      if (linkError) {
        console.error('❌ Failed to generate login link:', linkError);
        // Возвращаем данные пользователя, фронтенд залогинит через обычный login
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          emailConfirmed: true,
        };
      }

      // Удаляем использованный токен только после успешной генерации login link
      await this.prisma.pendingBusinessRegistration.delete({
        where: { id: pendingReg.id },
      });

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        emailConfirmed: true,
        loginUrl: linkData.properties?.action_link,
      };
    } catch (error) {
      console.error('❌ Error verifying business magic link:', error);
      throw error;
    }
  }
}
