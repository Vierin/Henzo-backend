import { Injectable, Inject, forwardRef, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { nanoid } from 'nanoid';
import { toZonedTime, format } from 'date-fns-tz';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  async findOrCreateClientUser(
    email: string,
    name?: string,
    phone?: string,
  ): Promise<string> {
    try {
      // Try to find existing user by email
      let user = await this.prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (user) {
        // If user exists but is not a client, throw error
        if (user.role !== 'CLIENT') {
          throw new Error(
            `User with email ${email} exists but is not a client`,
          );
        }
        // Update user info if provided
        if (name || phone) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: {
              ...(name && { name }),
              ...(phone && { phone }),
            },
          });
        }
        return user.id;
      }

      // Create new client user
      // Note: We create a user without password - they can set it later via password reset
      const emailNormalized = email.toLowerCase().trim();
      if (!emailNormalized) {
        throw new Error('Email is required to create client user');
      }

      const newUser = await this.prisma.user.create({
        data: {
          email: emailNormalized,
          name: name || emailNormalized.split('@')[0], // Use email prefix as default name
          phone: phone || null,
          role: 'CLIENT',
          // Mark as guest so we can later "upgrade" this user to a full account
          // during explicit registration flow without treating it as a conflict.
          // @ts-ignore - isGuest field will be available after migration
          isGuest: true,
          // Password will be set when user first logs in via password reset
        },
      });

      this.logger.log('Created new client user', {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      });
      return newUser.id;
    } catch (error) {
      this.logger.error('Error finding/creating client user', error);
      throw error;
    }
  }

  async createAnonymousClientUser(
    name: string,
    phone?: string,
  ): Promise<string> {
    try {
      // Create a temporary anonymous client user without email
      // Use a unique identifier based on timestamp and random string
      const anonymousEmail = `anonymous-${Date.now()}-${nanoid(8)}@anonymous.local`;

      const newUser = await this.prisma.user.create({
        data: {
          email: anonymousEmail,
          name: name,
          phone: phone || null,
          role: 'CLIENT',
          // Mark as guest/anonymous
          // @ts-ignore - isGuest field will be available after migration
          isGuest: true,
          // No password - this is an anonymous booking
        },
      });

      this.logger.log('Created anonymous client user', {
        id: newUser.id,
        name: newUser.name,
      });
      return newUser.id;
    } catch (error) {
      this.logger.error('Error creating anonymous client user', error);
      throw error;
    }
  }

  async createBooking(
    data: CreateBookingDto,
    userId: string,
    isOwnerCreated: boolean = false,
  ) {
    try {
      // Validate that the service exists and belongs to the salon
      const service = await this.prisma.service.findFirst({
        where: {
          id: data.serviceId,
          salonId: data.salonId,
        },
      });

      if (!service) {
        throw new Error('Service not found or does not belong to this salon');
      }

      let selectedStaffId = data.staffId;
      const bookingTime = new Date(data.time);
      const bookingEndTime = new Date(
        bookingTime.getTime() + service.duration * 60000,
      );

      // If no staff selected, find an available staff member
      if (!selectedStaffId) {
        selectedStaffId =
          (await this.findAvailableStaff(
            data.salonId,
            bookingTime,
            service.duration,
          )) || undefined;

        // Double-check availability even if findAvailableStaff returned a staff member
        if (selectedStaffId) {
          const isStaffAvailable = await this.checkStaffAvailability(
            selectedStaffId,
            bookingTime,
            bookingEndTime,
          );

          if (!isStaffAvailable) {
            // Try to find another available staff member
            const allStaff = await this.prisma.staff.findMany({
              where: { salonId: data.salonId },
            });

            for (const staff of allStaff) {
              if (staff.id !== selectedStaffId) {
                const isAvailable = await this.checkStaffAvailability(
                  staff.id,
                  bookingTime,
                  bookingEndTime,
                );
                if (isAvailable) {
                  selectedStaffId = staff.id;
                  break;
                }
              }
            }

            // If still no available staff, throw error
            if (
              !selectedStaffId ||
              !(await this.checkStaffAvailability(
                selectedStaffId,
                bookingTime,
                bookingEndTime,
              ))
            ) {
              throw new Error(
                'No staff members are available at this time. Please choose another time.',
              );
            }
          }
        }
      } else {
        // Validate that selected staff is available at this time
        const isStaffAvailable = await this.checkStaffAvailability(
          selectedStaffId,
          bookingTime,
          bookingEndTime,
        );

        if (!isStaffAvailable) {
          throw new Error(
            'Selected staff member is not available at this time. Please choose another time or staff member.',
          );
        }
      }

      // If owner creates booking, set status as CONFIRMED, otherwise PENDING
      const bookingStatus = isOwnerCreated ? 'CONFIRMED' : 'PENDING';

      // Create booking
      const booking = await this.prisma.booking.create({
        data: {
          salonId: data.salonId,
          userId: userId,
          serviceId: data.serviceId,
          staffId: selectedStaffId,
          dateTime: new Date(data.time),
          status: bookingStatus,
          notes: data.notes,
        },
        include: {
          Service: true,
          Staff: true,
          Salon: {
            select: {
              id: true,
              name: true,
              email: true,
              ownerId: true,
              timezone: true,
              address: true,
              phone: true,
              User: true, // Include owner for email fallback
            },
          },
          User: true, // Include user to get client email
        },
      });

      // Log booking creation details for debugging
      this.logger.log('Booking created with email notification details', {
        bookingId: booking.id,
        status: booking.status,
        clientEmail: booking.User?.email,
        clientName: booking.User?.name,
        salonEmail: booking.Salon?.email,
        ownerEmail: booking.Salon?.User?.email,
      });

      // Send email notifications asynchronously (don't block response)
      // Use setImmediate to send in next event loop tick, allowing response to return immediately
      setImmediate(async () => {
        try {
          await this.sendBookingNotifications(
            booking,
            isOwnerCreated,
            data.clientName,
          );
          this.logger.log('Email notifications sent successfully');
        } catch (emailError) {
          this.logger.error('Error sending email notifications', emailError);
          // Don't fail the booking creation if email fails
        }
      });

      // Send push notifications if booking is PENDING (also async)
      if (booking.status === 'PENDING') {
        setImmediate(async () => {
          try {
            // If owner created booking without email, use clientName from DTO or "Anonymous Client"
            const salonOwnerId =
              booking.Salon?.ownerId || booking.Salon?.User?.id;
            const isOwnerBookingWithoutEmail =
              isOwnerCreated &&
              (!booking.User?.email || !booking.User?.email.trim()) &&
              booking.userId === salonOwnerId;

            let clientName =
              booking.User?.name || booking.User?.email || 'Unknown Client';
            if (isOwnerBookingWithoutEmail && data.clientName) {
              clientName = data.clientName;
            } else if (isOwnerBookingWithoutEmail && !data.clientName) {
              clientName = 'Anonymous Client';
            }

            const serviceName = booking.Service?.name || 'Service';

            await this.notificationsService.sendBookingNotification(
              booking.salonId,
              booking.id,
              clientName,
              serviceName,
              booking.dateTime,
            );
            this.logger.log('Push notification sent successfully');
          } catch (pushError) {
            this.logger.error('Error sending push notification', pushError);
            // Don't fail the booking creation if push notification fails
          }
        });
      }

      return booking;
    } catch (error) {
      this.logger.error('Error creating booking', error);
      throw error;
    }
  }

  /**
   * Transform Prisma booking response to frontend DTO format (camelCase)
   * Centralized transformation to avoid code duplication
   */
  private transformBookingToDto(booking: any) {
    return {
      id: booking.id,
      salonId: booking.salonId,
      serviceId: booking.serviceId,
      staffId: booking.staffId,
      time: booking.dateTime,
      status: booking.status,
      notes: booking.notes,
      createdAt: booking.createdAt,
      service: booking.Service
        ? {
            id: booking.Service.id,
            name: booking.Service.name,
            nameEn: booking.Service.nameEn,
            nameVi: booking.Service.nameVi,
            nameRu: booking.Service.nameRu,
            description: booking.Service.description,
            duration: booking.Service.duration,
            price: booking.Service.price,
          }
        : null,
      staff: booking.Staff
        ? {
            id: booking.Staff.id,
            name: booking.Staff.name,
          }
        : null,
      salon: booking.Salon
        ? {
            id: booking.Salon.id,
            name: booking.Salon.name,
            address: booking.Salon.address,
            phone: booking.Salon.phone,
            photos: booking.Salon.photos || [],
          }
        : null,
      user: booking.User
        ? {
            id: booking.User.id,
            name: booking.User.name,
            email: booking.User.email?.includes('@anonymous.local')
              ? null
              : booking.User.email,
          }
        : null,
    };
  }

  async getUserBookings(userId: string) {
    try {
      // P0: Используем select вместо include для уменьшения payload
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: userId,
        },
        select: {
          id: true,
          salonId: true,
          serviceId: true,
          staffId: true,
          status: true,
          notes: true,
          createdAt: true,
          dateTime: true,
          Service: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              duration: true,
              price: true,
              // Убираем description - не нужен для списка
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              // Убираем email, accessLevel - не нужны для списка
            },
          },
          Salon: {
            select: {
              id: true,
              name: true,
              photos: true, // Только для первого фото
              // Убираем address, phone, description - не нужны для списка
            },
          },
          // User не нужен для клиентского дашборда
        },
        orderBy: {
          dateTime: 'desc',
        },
      });

      // Transform Prisma response to frontend format (camelCase)
      return bookings.map((booking: any) =>
        this.transformBookingToDto(booking),
      );
    } catch (error) {
      throw error;
    }
  }

  async getUpcomingBookings(userId: string, options?: { limit?: number }) {
    try {
      const now = new Date();
      const limit = options?.limit || 50; // P0: Лимит на количество записей

      // P0: Используем select вместо include для уменьшения payload
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: userId,
          dateTime: {
            gte: now,
          },
          status: {
            in: ['PENDING', 'CONFIRMED'],
          },
        },
        take: limit, // P0: Лимит
        select: {
          id: true,
          salonId: true,
          serviceId: true,
          staffId: true,
          status: true,
          notes: true,
          createdAt: true,
          dateTime: true,
          Service: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              duration: true,
              price: true,
              // Убираем description - не нужен для списка
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              // Убираем email, accessLevel - не нужны для списка
            },
          },
          Salon: {
            select: {
              id: true,
              name: true,
              photos: true, // Только для первого фото
              // Убираем address, phone, description - не нужны для списка
            },
          },
          // User не нужен для клиентского дашборда
        },
        orderBy: {
          dateTime: 'asc', // P1: Сортировка на бэкенде
        },
      });

      // Transform Prisma response to frontend format (camelCase)
      return bookings.map((booking: any) =>
        this.transformBookingToDto(booking),
      );
    } catch (error) {
      throw error;
    }
  }

  async getCompletedBookings(
    userId: string,
    options?: { page?: number; limit?: number },
  ) {
    try {
      const now = new Date();
      const page = options?.page || 1;
      const limit = options?.limit || 30; // P0: По умолчанию 30 записей
      const skip = (page - 1) * limit; // P0: Пагинация

      // P0: Используем select вместо include для уменьшения payload
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: userId,
          dateTime: {
            lt: now,
          },
          status: {
            in: ['CONFIRMED', 'CANCELED', 'COMPLETED'],
          },
        },
        skip, // P0: Пагинация
        take: limit, // P0: Лимит
        select: {
          id: true,
          salonId: true,
          serviceId: true,
          staffId: true,
          status: true,
          notes: true,
          createdAt: true,
          dateTime: true,
          Service: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              duration: true,
              price: true,
              // Убираем description - не нужен для списка
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              // Убираем email, accessLevel - не нужны для списка
            },
          },
          Salon: {
            select: {
              id: true,
              name: true,
              photos: true, // Только для первого фото
              // Убираем address, phone, description - не нужны для списка
            },
          },
          // User не нужен для клиентского дашборда
        },
        orderBy: {
          dateTime: 'desc', // P1: Сортировка на бэкенде
        },
      });

      // Transform Prisma response to frontend format (camelCase)
      return bookings.map((booking: any) =>
        this.transformBookingToDto(booking),
      );
    } catch (error) {
      throw error;
    }
  }

  async getSalonBookings(salonId: string) {
    try {
      // Критично: Используем select вместо include для уменьшения payload
      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId: salonId,
        },
        select: {
          id: true,
          salonId: true,
          serviceId: true,
          staffId: true,
          userId: true,
          status: true,
          notes: true,
          createdAt: true,
          dateTime: true,
          Service: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              duration: true,
              price: true,
              // Убираем description - не нужен для списка
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              // Убираем email, accessLevel - не нужны для списка
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              // Убираем phone - не нужен для списка
            },
          },
          // Salon не нужен - уже знаем salonId
        },
        orderBy: {
          dateTime: 'desc',
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
    } catch (error) {
      this.logger.error('Error fetching salon bookings', error);
      throw error;
    }
  }

  async getPendingBookingsForSalon(salonId: string) {
    try {
      this.logger.log('Fetching pending bookings for salon', { salonId });

      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId: salonId,
          status: 'PENDING',
        },
        include: {
          Service: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              description: true,
              duration: true,
              price: true,
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              email: true,
              accessLevel: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          Salon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc', // Новые сначала
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
    } catch (error) {
      this.logger.error('Error fetching pending bookings', error);
      throw error;
    }
  }

  async getPendingBookingsCountForSalon(salonId: string): Promise<number> {
    try {
      const count = await this.prisma.booking.count({
        where: {
          salonId: salonId,
          status: 'PENDING',
        },
      });

      return count;
    } catch (error) {
      this.logger.error('Error counting pending bookings', error);
      throw error;
    }
  }

  async verifySalonOwnership(
    salonId: string,
    ownerId: string,
  ): Promise<boolean> {
    try {
      const salon = await this.prisma.salon.findFirst({
        where: {
          id: salonId,
          ownerId: ownerId,
        },
      });

      return !!salon;
    } catch (error) {
      this.logger.error('Error verifying salon ownership', error);
      return false;
    }
  }

  async getOwnerBookings(
    ownerId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: string;
      date?: string;
    },
  ) {
    try {
      const page = options?.page || 1;
      const limit = Math.min(options?.limit || 50, 100); // Max 100 per page
      const skip = (page - 1) * limit;

      this.logger.log('Fetching bookings for owner', {
        ownerId,
        page,
        limit,
        status: options?.status,
        date: options?.date,
      });

      // Сначала находим салоны, принадлежащие владельцу
      const ownerSalons = await this.prisma.salon.findMany({
        where: {
          ownerId: ownerId,
        },
        select: {
          id: true,
        },
      });

      if (ownerSalons.length === 0) {
        this.logger.warn('No salons found for owner', { ownerId });
        return [];
      }

      const salonIds = ownerSalons.map((salon) => salon.id);

      // Build where clause with filters
      const where: any = {
        salonId: {
          in: salonIds,
        },
      };

      // P2: По умолчанию загружаем только будущие бронирования или последние 30 дней
      // Это значительно уменьшает количество данных
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (options?.date) {
        // Parse date filter (format: YYYY-MM-DD or 'today', 'this_week', etc.)
        if (options.date === 'today') {
          const startOfDay = new Date(now.setHours(0, 0, 0, 0));
          const endOfDay = new Date(now.setHours(23, 59, 59, 999));
          where.dateTime = {
            gte: startOfDay,
            lte: endOfDay,
          };
        } else if (options.date === 'this_week') {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          where.dateTime = {
            gte: startOfWeek,
          };
        } else if (options.date === 'upcoming') {
          where.dateTime = {
            gte: now,
          };
        } else if (options.date === 'past') {
          where.dateTime = {
            lt: now,
          };
        } else {
          // Try to parse as date string YYYY-MM-DD
          const dateMatch = options.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateMatch) {
            const [, year, month, day] = dateMatch;
            const startOfDay = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              0,
              0,
              0,
            );
            const endOfDay = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              23,
              59,
              59,
            );
            where.dateTime = {
              gte: startOfDay,
              lte: endOfDay,
            };
          }
        }
      } else {
        // P2: По умолчанию загружаем только будущие бронирования или последние 30 дней
        where.dateTime = {
          gte: thirtyDaysAgo,
        };
      }

      if (options?.status) {
        where.status = options.status;
      }

      // P1: Оптимизация - используем select вместо include для уменьшения payload
      // Загружаем только необходимые поля
      const bookings = await this.prisma.booking.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          salonId: true,
          serviceId: true,
          staffId: true,
          userId: true,
          status: true,
          notes: true,
          createdAt: true,
          dateTime: true,
          Service: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              duration: true,
              price: true,
              // Убираем description - не нужен для списка
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              // Убираем email и accessLevel - не нужны для списка
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          Salon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          dateTime: 'desc',
        },
      });

      // P2: Batch update теперь выполняется в фоновой задаче (BookingsScheduler)
      // Только локально обновляем статус для уже загруженных данных
      // Используем уже объявленную переменную now
      const updatedBookings = bookings.map((booking) => {
        // Обновляем статус локально для прошедших бронирований
        if (
          (booking.status === 'CONFIRMED' || booking.status === 'PENDING') &&
          booking.dateTime < now
        ) {
          return {
            ...booking,
            status: 'COMPLETED' as any,
          };
        }
        return booking;
      });

      // Transform to DTO format
      return updatedBookings.map((booking: any) =>
        this.transformBookingToDto(booking),
      );
    } catch (error) {
      this.logger.error('Error fetching owner bookings', error);
      throw error;
    }
  }

  private async findAvailableStaff(
    salonId: string,
    bookingTime: Date,
    serviceDuration: number,
  ) {
    try {
      // Calculate booking end time
      const bookingEndTime = new Date(
        bookingTime.getTime() + serviceDuration * 60000,
      );

      // Get all staff members for this salon
      const allStaff = await this.prisma.staff.findMany({
        where: {
          salonId: salonId,
        },
      });

      if (allStaff.length === 0) {
        this.logger.warn('No staff members found for salon', { salonId });
        return null;
      }

      // OPTIMIZED: Get all conflicting bookings in one query instead of N+1
      const staffIds = allStaff.map((s) => s.id);
      const conflictingBookings = await this.prisma.booking.findMany({
        where: {
          salonId,
          staffId: { in: staffIds },
          status: {
            in: ['PENDING', 'CONFIRMED'],
          },
          OR: [
            // Booking starts during our booking time
            {
              dateTime: {
                gte: bookingTime,
                lt: bookingEndTime,
              },
            },
            // Booking ends during our booking time
            {
              dateTime: {
                lte: bookingTime,
                gte: new Date(bookingTime.getTime() - 60 * 60 * 1000), // Check 1 hour before
              },
            },
          ],
        },
        select: { staffId: true },
      });

      // Create a set of busy staff IDs for O(1) lookup
      const busyStaffIds = new Set(
        conflictingBookings.map((b) => b.staffId).filter(Boolean),
      );

      // Filter available staff
      const availableStaff = allStaff.filter(
        (staff) => !busyStaffIds.has(staff.id),
      );

      if (availableStaff.length === 0) {
        this.logger.warn('No available staff found, using first staff member', {
          salonId,
        });
        return allStaff[0].id;
      }

      // Randomly select from available staff
      const randomIndex = Math.floor(Math.random() * availableStaff.length);
      const selectedStaff = availableStaff[randomIndex];

      return selectedStaff.id;
    } catch (error) {
      this.logger.error('Error finding available staff', error);
      // Fallback to first staff member if error occurs
      const fallbackStaff = await this.prisma.staff.findFirst({
        where: { salonId },
      });
      return fallbackStaff?.id || null;
    }
  }

  /**
   * Check if a specific staff member is available at the given time slot
   * Returns true if available, false if there's a conflict
   */
  private async checkStaffAvailability(
    staffId: string,
    bookingStartTime: Date,
    bookingEndTime: Date,
  ): Promise<boolean> {
    try {
      // Get all existing bookings for this staff member that might conflict
      const existingBookings = await this.prisma.booking.findMany({
        where: {
          staffId: staffId,
          status: {
            in: ['PENDING', 'CONFIRMED'],
          },
        },
        include: {
          Service: {
            select: {
              duration: true,
            },
          },
        },
      });

      // Check each existing booking for overlap
      for (const existingBooking of existingBookings) {
        const existingStartTime = existingBooking.dateTime;
        const existingEndTime = new Date(
          existingStartTime.getTime() +
            (existingBooking.Service?.duration || 0) * 60000,
        );

        // Check if there's any overlap
        // Two time slots overlap if:
        // - existingStartTime < bookingEndTime AND existingEndTime > bookingStartTime
        // This covers all cases: partial overlap, complete containment, etc.
        const hasOverlap =
          existingStartTime < bookingEndTime &&
          existingEndTime > bookingStartTime;

        if (hasOverlap) {
          this.logger.warn('Staff member has conflicting booking', {
            staffId,
            bookingStartTime,
            bookingEndTime,
            conflictingBookingId: existingBooking.id,
            conflictingBookingTime: existingStartTime,
            conflictingBookingEndTime: existingEndTime,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking staff availability', error);
      // In case of error, allow booking (fail open) but log the error
      return true;
    }
  }

  private async sendBookingNotifications(
    booking: any,
    isOwnerCreated: boolean = false,
    clientNameFromDto?: string,
  ) {
    try {
      // Format booking data for emails - parse UTC time without timezone conversion
      const dateTimeString =
        booking.dateTime?.toISOString?.() ||
        booking.dateTime?.toString() ||
        booking.dateTime;
      const { formattedDate, formattedTime } = this.formatBookingDateTime(
        dateTimeString,
        booking.Salon?.timezone || 'Asia/Ho_Chi_Minh',
      );

      // Get client email and name
      let clientEmail = booking.User?.email;

      // Determine if this is an anonymous booking (owner created without client email)
      const salonOwnerId = booking.Salon?.ownerId || booking.Salon?.User?.id;
      const isAnonymousUser = booking.User?.email?.includes('@anonymous.local');
      // If anonymous user was created, userId will be different from ownerId
      // If anonymous user was NOT created (fallback), userId will be ownerId
      const isOwnerBookingWithoutEmail =
        isOwnerCreated &&
        (isAnonymousUser ||
          (booking.userId === salonOwnerId &&
            (!clientEmail || !clientEmail.trim())));

      // If this is an anonymous booking, set clientEmail to null
      if (
        isAnonymousUser ||
        (isOwnerCreated &&
          booking.userId === salonOwnerId &&
          (!clientEmail || !clientEmail.trim()))
      ) {
        clientEmail = null;
      }

      let clientName = booking.User?.name || 'Client';
      if (isOwnerBookingWithoutEmail && clientNameFromDto) {
        clientName = clientNameFromDto;
      } else if (isOwnerBookingWithoutEmail && !clientNameFromDto) {
        clientName = 'Anonymous Client';
      } else if (isAnonymousUser) {
        // Use the name from anonymous user or from DTO
        clientName =
          clientNameFromDto || booking.User?.name || 'Anonymous Client';
      }

      // If no email and owner created booking without email, skip email notifications
      if (!clientEmail || !clientEmail.trim() || isAnonymousUser) {
        if (isOwnerBookingWithoutEmail || isAnonymousUser) {
          this.logger.log(
            'Skipping email notifications: owner created booking without client email',
            {
              bookingId: booking.id,
              userId: booking.userId,
              salonOwnerId: salonOwnerId,
              isAnonymousUser: isAnonymousUser,
              userEmail: booking.User?.email,
            },
          );
          return; // Don't send any emails
        } else {
          // For regular bookings without email, log warning but don't send emails
          this.logger.warn(
            'Cannot send email: client email is missing, skipping notifications',
            {
              bookingId: booking.id,
              userId: booking.userId,
              user: booking.User,
            },
          );
          return; // Don't send any emails
        }
      }

      this.logger.log('Preparing to send email notifications', {
        status: booking.status,
        clientEmail,
        clientName,
        salonEmail: booking.Salon?.email || booking.Salon?.User?.email,
        isAnonymousUser: isAnonymousUser,
        isOwnerBookingWithoutEmail: isOwnerBookingWithoutEmail,
        userId: booking.userId,
        salonOwnerId: salonOwnerId,
        userEmail: booking.User?.email,
      });

      // For PENDING bookings, send notification to salon and client
      if (booking.status === 'PENDING') {
        // Send email to salon owner - prefer salon email, fallback to owner email
        const salonEmail =
          booking.Salon?.email && booking.Salon.email.trim()
            ? booking.Salon.email
            : booking.Salon?.User?.email;
        if (salonEmail && salonEmail.trim()) {
          await this.emailService.sendSalonBookingRequest(
            salonEmail,
            booking.Salon?.name || '',
            {
              bookingId: booking.id,
              serviceName: booking.Service?.name || '',
              date: formattedDate,
              time: formattedTime,
              duration: booking.Service?.duration || 0,
              price: booking.Service?.price || 0,
              clientName,
              clientEmail,
              clientPhone: booking.User?.phone || null,
              staffName: booking.Staff?.name,
            },
          );
          this.logger.log('Salon booking request email sent', { salonEmail });
        } else {
          this.logger.warn(
            'Salon email not found, skipping salon notification',
            {
              salonId: booking.salonId,
              salonEmail: booking.Salon?.email,
              ownerEmail: booking.Salon?.User?.email,
            },
          );
        }

        // Send email to client about pending booking
        try {
          const salonTimezone =
            (booking.Salon as any)?.timezone || 'Asia/Ho_Chi_Minh';
          const workingHours = (booking.Salon as any)?.workingHours;
          const isWithinWorkingHours = this.isWithinWorkingHours(
            workingHours,
            salonTimezone,
          );

          await this.emailService.sendBookingPending(
            clientEmail,
            clientName,
            {
              serviceName: booking.Service?.name || '',
              date: formattedDate,
              time: formattedTime,
              duration: booking.Service?.duration || 0,
              price: booking.Service?.price || 0,
              salonName: booking.Salon?.name || '',
              salonAddress: booking.Salon?.address || null,
              salonPhone: booking.Salon?.phone || null,
              staffName: booking.Staff?.name,
              dateTime: booking.dateTime,
              salonTimezone: salonTimezone,
              isWithinWorkingHours: isWithinWorkingHours,
            },
          );
          this.logger.log('Client pending booking email sent', { clientEmail });
        } catch (clientEmailError) {
          this.logger.error(
            'Error sending client pending booking email',
            clientEmailError,
          );
          // Don't fail the whole process if client email fails
        }
      } else if (booking.status === 'CONFIRMED') {
        // Send confirmation to client
        this.logger.log('Sending confirmation email to client', {
          clientEmail,
        });
        await this.emailService.sendBookingConfirmation(
          clientEmail,
          clientName,
          {
            serviceName: booking.Service?.name || '',
            date: formattedDate,
            time: formattedTime,
            duration: booking.Service?.duration || 0,
            price: booking.Service?.price || 0,
            salonName: booking.Salon?.name || '',
            salonAddress: booking.Salon?.address || null,
            salonPhone: booking.Salon?.phone || null,
            staffName: booking.Staff?.name,
            dateTime: booking.dateTime,
          },
        );
        this.logger.log('Client confirmation email sent', { clientEmail });

        // Send notification to salon
        const salonEmail =
          booking.Salon?.email && booking.Salon.email.trim()
            ? booking.Salon.email
            : booking.Salon?.User?.email;
        if (salonEmail && salonEmail.trim()) {
          await this.emailService.sendSalonNotification(
            salonEmail,
            booking.Salon?.name || '',
            {
              serviceName: booking.Service?.name || '',
              date: formattedDate,
              time: formattedTime,
              duration: booking.Service?.duration || 0,
              price: booking.Service?.price || 0,
              clientName,
              clientEmail,
              clientPhone: booking.User?.phone || null,
              staffName: booking.Staff?.name,
            },
          );
          this.logger.log('Salon notification email sent', { salonEmail });
        } else {
          this.logger.warn(
            'Salon email not found, skipping salon notification',
          );
        }
      }
    } catch (error) {
      this.logger.error('Error sending booking notifications', error);
      throw error;
    }
  }

  async cancelBooking(bookingId: string, userId: string) {
    try {
      // Check if booking exists
      const booking = await this.prisma.booking.findFirst({
        where: {
          id: bookingId,
        },
        select: {
          id: true,
          userId: true,
          salonId: true,
          serviceId: true,
          staffId: true,
          status: true,
          dateTime: true,
          createdAt: true,
          Salon: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              timezone: true,
              photos: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      if (!booking) {
        this.logger.warn('Booking not found', { bookingId });
        throw new Error('Booking not found');
      }

      // Check if user has permission to cancel (either the client or salon owner)
      const isClient = booking.userId === userId;
      const isOwner = booking.Salon?.ownerId === userId;

      this.logger.log('Permission check', {
        isClient,
        isOwner,
        bookingId,
        userId,
      });

      if (!isClient && !isOwner) {
        this.logger.warn('No permission to cancel booking', {
          bookingId,
          userId,
        });
        throw new Error('You do not have permission to cancel this booking');
      }

      // Check if booking can be canceled (not already canceled or past)
      if (booking.status === 'CANCELED') {
        throw new Error('Booking is already canceled');
      }

      if (booking.status === ('COMPLETED' as any)) {
        throw new Error('Cannot cancel a booking that has already completed');
      }

      // Check if booking time has passed
      const now = new Date();
      if (booking.dateTime < now) {
        throw new Error('Cannot cancel a booking that has already passed');
      }

      // Update booking status to CANCELED
      const updatedBooking = await this.prisma.booking.update({
        where: {
          id: bookingId,
        },
        data: {
          status: 'CANCELED',
        },
        include: {
          Service: true,
          Staff: true,
          Salon: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              timezone: true,
              photos: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Send push notification to salon owner if client cancelled the booking
      if (isClient && booking.Salon?.id && updatedBooking.Service) {
        try {
          await this.notificationsService.sendBookingCancellationNotification(
            booking.Salon.id,
            bookingId,
            booking.User?.name || booking.User?.email || 'Client',
            updatedBooking.Service.name,
            new Date(booking.dateTime),
          );
        } catch (error) {
          this.logger.error('Failed to send cancellation notification', error);
          // Don't throw - notification failure shouldn't fail the cancellation
        }
      }

      return updatedBooking;
    } catch (error) {
      throw error;
    }
  }

  async updateBooking(
    bookingId: string,
    data: {
      serviceId?: string;
      staffId?: string;
      time?: string;
      notes?: string;
      status?: string;
    },
    ownerId: string,
  ) {
    try {
      // First, verify that the booking belongs to one of the owner's salons
      const existingBooking = await this.prisma.booking.findFirst({
        where: { id: bookingId },
        include: {
          Salon: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              timezone: true,
              photos: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          Service: true,
          Staff: true,
        },
      });

      if (!existingBooking) {
        throw new Error('Booking not found');
      }

      if (existingBooking.Salon?.ownerId !== ownerId) {
        throw new Error(
          'Access denied. This booking does not belong to your salon.',
        );
      }

      // Prepare update data
      const updateData: any = {};

      if (data.serviceId) {
        // Validate that the service exists and belongs to the same salon
        const service = await this.prisma.service.findFirst({
          where: {
            id: data.serviceId,
            salonId: existingBooking.salonId,
          },
        });

        if (!service) {
          throw new Error('Service not found or does not belong to this salon');
        }

        updateData.Service = { connect: { id: data.serviceId } };
      }

      if (data.staffId) {
        // Validate that the staff member exists and belongs to the same salon
        const staff = await this.prisma.staff.findFirst({
          where: {
            id: data.staffId,
            salonId: existingBooking.salonId,
          },
        });

        if (!staff) {
          throw new Error(
            'Staff member not found or does not belong to this salon',
          );
        }

        updateData.Staff = { connect: { id: data.staffId } };
      }

      if (data.time) {
        updateData.dateTime = new Date(data.time);
      }

      if (data.notes !== undefined) {
        updateData.notes = data.notes;
      }

      if (data.status) {
        updateData.status = data.status;
      }

      // Track if status changed
      const statusChanged =
        data.status && data.status !== existingBooking.status;
      const oldStatus = existingBooking.status;

      // Update the booking
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: {
          Service: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              nameVi: true,
              nameRu: true,
              description: true,
              duration: true,
              price: true,
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
              email: true,
              accessLevel: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
          Salon: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Send email notification if status changed
      if (statusChanged && updatedBooking.User?.email) {
        try {
          // Format date and time for email - use UTC to avoid timezone conversion
          const bookingDate = new Date(updatedBooking.dateTime);
          const formattedDate = bookingDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
          });
          // Use UTC hours and minutes directly to avoid timezone conversion
          const hours = bookingDate.getUTCHours().toString().padStart(2, '0');
          const minutes = bookingDate
            .getUTCMinutes()
            .toString()
            .padStart(2, '0');
          const formattedTime = `${hours}:${minutes}`;

          if (data.status === 'CONFIRMED') {
            // Send confirmation email to client
            await this.emailService.sendBookingConfirmation(
              updatedBooking.User?.email || '',
              updatedBooking.User?.name || 'Client',
              {
                serviceName: updatedBooking.Service?.name || '',
                date: formattedDate,
                time: formattedTime,
                duration: updatedBooking.Service?.duration || 0,
                price: updatedBooking.Service?.price || 0,
                salonName: updatedBooking.Salon?.name || '',
                salonTimezone:
                  (updatedBooking.Salon as any)?.timezone || 'Asia/Ho_Chi_Minh',
              },
            );
          } else if (data.status === 'CANCELED') {
            // Send rejection email to client
            await this.emailService.sendBookingRejection(
              updatedBooking.User?.email || '',
              updatedBooking.User?.name || 'Client',
              {
                serviceName: updatedBooking.Service?.name || '',
                date: formattedDate,
                time: formattedTime,
                duration: updatedBooking.Service?.duration || 0,
                price: updatedBooking.Service?.price || 0,
                salonName: updatedBooking.Salon?.name || '',
              },
            );
          }
        } catch (emailError) {
          this.logger.error('Error sending status change email', emailError);
          // Don't fail the update if email fails
        }
      }

      return updatedBooking;
    } catch (error) {
      this.logger.error('Update booking error', error);
      throw error;
    }
  }

  async updateBookingsToCompleted(bookingIds: string[], ownerId: string) {
    try {
      // Verify that all bookings belong to the owner's salons
      const ownerSalons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: { id: true },
      });

      const salonIds = ownerSalons.map((salon) => salon.id);

      // Update bookings to COMPLETED status
      const result = await this.prisma.booking.updateMany({
        where: {
          id: {
            in: bookingIds,
          },
          salonId: {
            in: salonIds,
          },
          status: {
            in: ['CONFIRMED', 'PENDING'], // Update confirmed or pending bookings
          },
        },
        data: {
          status: 'COMPLETED' as any,
        },
      });

      return { count: result.count };
    } catch (error) {
      this.logger.error('Update bookings to completed error', error);
      throw error;
    }
  }

  async getBookingsByDateAndSalon(
    salonId: string,
    date: string,
    status: string = 'CONFIRMED',
  ) {
    try {
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');

      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId,
          status: status as any,
          dateTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: {
          Service: {
            select: {
              duration: true,
            },
          },
        },
        orderBy: {
          dateTime: 'asc',
        },
      });

      // Map dateTime to time for frontend compatibility
      return bookings.map((booking) => ({
        ...booking,
        time: booking.dateTime,
      }));
    } catch (error) {
      this.logger.error('Error fetching bookings by date and salon', error);
      throw error;
    }
  }

  async confirmBooking(bookingId: string) {
    try {
      // Find booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          Service: true,
          Staff: true,
          Salon: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              timezone: true,
              photos: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'PENDING') {
        throw new Error('Only pending bookings can be confirmed');
      }

      // Update status to CONFIRMED
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CONFIRMED' },
        include: {
          Service: true,
          Staff: true,
          Salon: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              timezone: true,
              photos: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Send confirmation email to client
      const dateTimeString = updatedBooking.dateTime.toISOString();
      const salonTimezone =
        (updatedBooking.Salon as any)?.timezone || 'Asia/Ho_Chi_Minh';
      const { formattedDate, formattedTime } = this.formatBookingDateTime(
        dateTimeString,
        salonTimezone,
      );

      await this.emailService.sendBookingConfirmation(
        updatedBooking.User?.email || '',
        updatedBooking.User?.name || 'Client',
        {
          serviceName: updatedBooking.Service?.name || '',
          date: formattedDate,
          time: formattedTime,
          duration: updatedBooking.Service?.duration || 0,
          price: updatedBooking.Service?.price || 0,
          salonName: updatedBooking.Salon?.name || '',
          salonAddress: updatedBooking.Salon?.address ?? undefined,
          salonPhone: updatedBooking.Salon?.phone ?? undefined,
          staffName: updatedBooking.Staff?.name,
          dateTime: updatedBooking.dateTime, // Pass dateTime for Google Calendar
          salonTimezone:
            (updatedBooking.Salon as any)?.timezone || 'Asia/Ho_Chi_Minh',
        },
      );

      return updatedBooking;
    } catch (error) {
      this.logger.error('Error confirming booking', error);
      throw error;
    }
  }

  async rejectBooking(bookingId: string, reason?: string) {
    try {
      // Find booking
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          Service: true,
          Staff: true,
          Salon: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              timezone: true,
              photos: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'PENDING') {
        throw new Error('Only pending bookings can be rejected');
      }

      // Update status to CANCELED
      const updatedBooking = await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELED' },
        include: {
          Service: true,
          Staff: true,
          Salon: {
            select: {
              id: true,
              ownerId: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              timezone: true,
              photos: true,
              User: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          User: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
            },
          },
        },
      });

      // Send rejection email to client
      const dateTimeString = updatedBooking.dateTime.toISOString();
      const salonTimezone =
        (updatedBooking.Salon as any)?.timezone || 'Asia/Ho_Chi_Minh';
      const { formattedDate, formattedTime } = this.formatBookingDateTime(
        dateTimeString,
        salonTimezone,
      );

      await this.emailService.sendBookingRejection(
        updatedBooking.User?.email || '',
        updatedBooking.User?.name || 'Client',
        {
          serviceName: updatedBooking.Service?.name || '',
          date: formattedDate,
          time: formattedTime,
          duration: updatedBooking.Service?.duration || 0,
          price: updatedBooking.Service?.price || 0,
          salonName: updatedBooking.Salon?.name || '',
          salonAddress: updatedBooking.Salon?.address ?? undefined,
          salonPhone: updatedBooking.Salon?.phone ?? undefined,
          staffName: updatedBooking.Staff?.name,
          reason,
          salonTimezone: salonTimezone,
        } as any,
      );

      this.logger.log('Booking rejected successfully', { bookingId });
      return updatedBooking;
    } catch (error) {
      this.logger.error('Error rejecting booking', error);
      throw error;
    }
  }

  /**
   * Check if current time is within salon's working hours
   */
  private isWithinWorkingHours(
    workingHours: any,
    salonTimezone: string = 'Asia/Ho_Chi_Minh',
  ): boolean {
    if (!workingHours || typeof workingHours !== 'object') {
      return true; // Assume open if no working hours specified
    }

    const now = new Date();
    const zonedNow = toZonedTime(now, salonTimezone);
    const dayOfWeek = zonedNow.getDay();
    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];
    const dayName = dayNames[dayOfWeek];
    const dayHours = workingHours[dayName];

    if (!dayHours || dayHours.closed) {
      return false; // Salon is closed on this day
    }

    const currentHour = zonedNow.getHours();
    const currentMinute = zonedNow.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const [openHour, openMinute] = (dayHours.open || '09:00')
      .split(':')
      .map(Number);
    const [closeHour, closeMinute] = (dayHours.close || '18:00')
      .split(':')
      .map(Number);

    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    // Handle overnight shifts (e.g., 22:00 - 06:00)
    if (closeTimeInMinutes < openTimeInMinutes) {
      return (
        currentTimeInMinutes >= openTimeInMinutes ||
        currentTimeInMinutes <= closeTimeInMinutes
      );
    }

    // Normal working hours
    return (
      currentTimeInMinutes >= openTimeInMinutes &&
      currentTimeInMinutes < closeTimeInMinutes
    );
  }

  /**
   * Format booking datetime from UTC to salon's timezone
   * Uses IANA timezone identifier (e.g., "Asia/Ho_Chi_Minh")
   */
  private formatBookingDateTime(
    dateTimeString: string,
    salonTimezone: string = 'Asia/Ho_Chi_Minh',
  ) {
    try {
      // Parse the UTC date string
      const utcDate = new Date(dateTimeString);

      // Check if the date is valid
      if (isNaN(utcDate.getTime())) {
        throw new Error(`Invalid date string: ${dateTimeString}`);
      }

      // IMPORTANT: The dateTime stored in DB is in UTC
      // We need to convert it to salon's local timezone for display
      // Example: 13:15 UTC in Asia/Ho_Chi_Minh = 20:15 local time

      // Convert from UTC to salon's timezone using date-fns-tz
      const zonedDate = toZonedTime(utcDate, salonTimezone);

      // Format date in salon's timezone
      const formattedDate = format(zonedDate, 'EEEE, MMMM d, yyyy', {
        timeZone: salonTimezone,
      });

      // Format time in salon's timezone
      const formattedTime = format(zonedDate, 'HH:mm', {
        timeZone: salonTimezone,
      });

      this.logger.log('Formatting booking datetime:', {
        input: dateTimeString,
        salonTimezone,
        utcTime: utcDate.toISOString(),
        zonedTime: zonedDate.toISOString(),
        formattedDate,
        formattedTime,
      });

      return { formattedDate, formattedTime };
    } catch (error) {
      this.logger.error('Error formatting booking datetime', error);
      // Fallback to original string
      return {
        formattedDate: 'Invalid Date',
        formattedTime: 'Invalid Time',
      };
    }
  }

  async sendMagicLink(email: string, bookingData: CreateBookingDto) {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        // If user exists and is a CLIENT, don't send magic link
        // User should login with password instead
        if (existingUser.role === 'CLIENT') {
          this.logger.log('User already exists, magic link not sent', {
            email: normalizedEmail,
            userId: existingUser.id,
            role: existingUser.role,
          });
          throw new Error('USER_EXISTS');
        }
        // If user exists but is not CLIENT (e.g., OWNER), also don't send magic link
        this.logger.log(
          'User exists with different role, magic link not sent',
          {
            email: normalizedEmail,
            userId: existingUser.id,
            role: existingUser.role,
          },
        );
        throw new Error('USER_EXISTS');
      }

      // Generate secure token
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store pending booking in database
      const pendingBooking = await this.prisma.pendingBooking.create({
        data: {
          token,
          email: normalizedEmail,
          bookingData: bookingData as any,
          expiresAt,
        },
      });

      // Generate confirmation URL
      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        (process.env.NODE_ENV === 'production'
          ? 'https://henzo.app'
          : 'http://localhost:3000');
      // Default to 'en' locale, but can be customized
      const confirmUrl = `${frontendUrl}/en/booking-confirmed?token=${token}`;

      // Format booking data for email
      const service = await this.prisma.service.findUnique({
        where: { id: bookingData.serviceId },
      });

      const salon = await this.prisma.salon.findUnique({
        where: { id: bookingData.salonId },
      });

      const bookingDateTime = new Date(bookingData.time);
      const { formattedDate, formattedTime } = this.formatBookingDateTime(
        bookingDateTime.toISOString(),
        (salon as any)?.timezone || 'Asia/Ho_Chi_Minh',
      );

      // Send magic link email
      await this.emailService.sendMagicLinkConfirmation(email, {
        confirmUrl,
        serviceName: service?.name || 'Service',
        salonName: salon?.name || 'Salon',
        date: formattedDate,
        time: formattedTime,
      });

      this.logger.log('Magic link sent', { email });
      return { success: true, token: pendingBooking.id };
    } catch (error) {
      this.logger.error('Error sending magic link', error);
      throw error;
    }
  }

  async confirmMagicLink(token: string) {
    try {
      // Find pending booking
      const pendingBooking = await this.prisma.pendingBooking.findFirst({
        where: {
          token,
          expiresAt: {
            gt: new Date(),
          },
        },
      });

      if (!pendingBooking) {
        throw new Error('Invalid or expired confirmation link');
      }

      // Find or create client user
      const userId = await this.findOrCreateClientUser(
        pendingBooking.email,
        undefined,
        undefined,
      );

      // Convert bookingData from Json to CreateBookingDto
      const bookingData =
        pendingBooking.bookingData as unknown as CreateBookingDto;

      // Validate booking data structure
      if (!bookingData.serviceId || !bookingData.time || !bookingData.salonId) {
        throw new Error('Invalid booking data in pending booking');
      }

      // Create booking
      const booking = await this.createBooking(
        bookingData,
        userId,
        false, // Not owner-created, so status will be PENDING
      );

      // Delete pending booking
      await this.prisma.pendingBooking.delete({
        where: { id: pendingBooking.id },
      });

      this.logger.log('Magic link confirmed, booking created', {
        bookingId: booking.id,
        email: pendingBooking.email,
      });
      return { bookingId: booking.id, booking, email: pendingBooking.email };
    } catch (error) {
      this.logger.error('Error confirming magic link', error);
      throw error;
    }
  }
}
