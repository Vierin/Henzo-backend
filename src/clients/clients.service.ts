import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get clients for a salon owner with DB-level pagination.
   * Returns one page of unique clients with aggregated stats, ordered by last visit desc.
   */
  async getClients(
    ownerId: string,
    options?: { search?: string; page?: number; limit?: number },
  ) {
    try {
      const ownerSalons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: { id: true },
      });

      if (ownerSalons.length === 0) {
        return {
          data: [],
          pagination: {
            page: 1,
            limit: options?.limit ?? 50,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      const salonIds = ownerSalons.map((s) => s.id);
      const page = options?.page ?? 1;
      const limit = Math.min(options?.limit ?? 50, 100);
      const skip = (page - 1) * limit;
      const search = options?.search?.trim();

      const searchPattern = search ? `%${search}%` : '%';

      // Total count of distinct clients (with optional search)
      const countResult = await this.prisma.$queryRawUnsafe<[{ count: bigint }]>(
        `SELECT COUNT(*)::int as count FROM (
          SELECT b."userId" FROM "Booking" b
          INNER JOIN "User" u ON u.id = b."userId"
          WHERE b."salonId" = ANY($1::text[]) AND u.email NOT LIKE '%@anonymous.local%'
          AND (u.name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2)
          GROUP BY b."userId"
        ) sub`,
        salonIds,
        searchPattern,
      );
      const total = Number(countResult[0]?.count ?? 0);

      if (total === 0) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        };
      }

      // One page of userIds ordered by last booking date desc
      const userIdRows = await this.prisma.$queryRawUnsafe<{ userId: string }[]>(
        `SELECT b."userId" FROM "Booking" b
         INNER JOIN "User" u ON u.id = b."userId"
         WHERE b."salonId" = ANY($1::text[]) AND u.email NOT LIKE '%@anonymous.local%'
         AND (u.name ILIKE $2 OR u.email ILIKE $2 OR u.phone ILIKE $2)
         GROUP BY b."userId"
         ORDER BY MAX(b."dateTime") DESC NULLS LAST
         LIMIT $3 OFFSET $4`,
        salonIds,
        searchPattern,
        limit,
        skip,
      );

      const userIds = userIdRows.map((r) => r.userId);
      if (userIds.length === 0) {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasNextPage: page * limit < total,
            hasPreviousPage: page > 1,
          },
        };
      }

      const userSearchCondition = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : undefined;

      const [users, bookingStats, completedBookings] = await Promise.all([
        this.prisma.user.findMany({
          where: {
            id: { in: userIds },
            email: { not: { contains: '@anonymous.local' } },
            ...(userSearchCondition || {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true,
          },
        }),
        this.prisma.booking.groupBy({
          by: ['userId'],
          where: { userId: { in: userIds }, salonId: { in: salonIds } },
          _count: { id: true },
          _max: { dateTime: true },
        }),
        this.prisma.booking.findMany({
          where: {
            userId: { in: userIds },
            salonId: { in: salonIds },
            status: 'COMPLETED',
          },
          select: {
            userId: true,
            Service: { select: { price: true } },
          },
        }),
      ]);

      const statsMap = new Map<
        string,
        { visitCount: number; lastVisit: Date | null; totalSpent: number; completedVisits: number }
      >();
      for (const stat of bookingStats) {
        statsMap.set(stat.userId, {
          visitCount: stat._count.id,
          lastVisit: stat._max.dateTime,
          totalSpent: 0,
          completedVisits: 0,
        });
      }
      for (const booking of completedBookings) {
        const s = statsMap.get(booking.userId);
        if (s) {
          s.totalSpent += booking.Service?.price ?? 0;
          s.completedVisits++;
        }
      }

      // Preserve order of userIds (by last visit desc)
      const data = userIds
        .map((userId) => {
          const user = users.find((u) => u.id === userId);
          const stats = statsMap.get(userId);
          if (!user || !stats) return null;
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            createdAt: user.createdAt,
            totalSpent: stats.totalSpent,
            visitCount: stats.visitCount,
            lastVisit: stats.lastVisit,
            completedVisits: stats.completedVisits,
          };
        })
        .filter(Boolean) as Array<{
        id: string;
        name: string | null;
        email: string;
        phone: string | null;
        createdAt: Date;
        totalSpent: number;
        visitCount: number;
        lastVisit: Date | null;
        completedVisits: number;
      }>;

      const totalPages = Math.ceil(total / limit);
      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Error fetching clients', error);
      throw new HttpException(
        'Failed to fetch clients',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a single client with full details
   */
  async getClientById(ownerId: string, clientId: string) {
    try {
      // Verify owner has access to this client
      const ownerSalons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: { id: true },
      });

      if (ownerSalons.length === 0) {
        throw new HttpException('No salons found', HttpStatus.NOT_FOUND);
      }

      const salonIds = ownerSalons.map((salon) => salon.id);

      // Check if client has bookings in owner's salons
      const hasAccess = await this.prisma.booking.findFirst({
        where: {
          userId: clientId,
          salonId: { in: salonIds },
        },
      });

      if (!hasAccess) {
        throw new HttpException(
          'Client not found or access denied',
          HttpStatus.NOT_FOUND,
        );
      }

      // Get client user info
      const user = await this.prisma.user.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
        },
      });

      if (!user) {
        throw new HttpException('Client not found', HttpStatus.NOT_FOUND);
      }

      // Get all bookings for this client in owner's salons
      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: clientId,
          salonId: { in: salonIds },
        },
        select: {
          id: true,
          dateTime: true,
          status: true,
          notes: true,
          createdAt: true,
          Service: {
            select: {
              id: true,
              name: true,
              price: true,
              duration: true,
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
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

      // Calculate stats
      const totalSpent = bookings
        .filter((b) => b.status === 'COMPLETED')
        .reduce((sum, b) => sum + b.Service.price, 0);

      const visitCount = bookings.length;
      const completedVisits = bookings.filter(
        (b) => b.status === 'COMPLETED',
      ).length;

      const lastVisit =
        bookings.length > 0 ? bookings[0].dateTime : null;

      return {
        ...user,
        totalSpent,
        visitCount,
        completedVisits,
        lastVisit,
        bookings,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error fetching client', error);
      throw new HttpException(
        'Failed to fetch client',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get client bookings
   */
  async getClientBookings(ownerId: string, clientId: string) {
    try {
      const ownerSalons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: { id: true },
      });

      if (ownerSalons.length === 0) {
        return [];
      }

      const salonIds = ownerSalons.map((salon) => salon.id);

      const bookings = await this.prisma.booking.findMany({
        where: {
          userId: clientId,
          salonId: { in: salonIds },
        },
        select: {
          id: true,
          dateTime: true,
          status: true,
          notes: true,
          createdAt: true,
          Service: {
            select: {
              id: true,
              name: true,
              price: true,
              duration: true,
            },
          },
          Staff: {
            select: {
              id: true,
              name: true,
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

      return bookings;
    } catch (error) {
      this.logger.error('Error fetching client bookings', error);
      throw new HttpException(
        'Failed to fetch client bookings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get notes for a client
   */
  async getClientNotes(ownerId: string, clientId: string) {
    try {
      const ownerSalons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: { id: true },
      });

      if (ownerSalons.length === 0) {
        return [];
      }

      const salonIds = ownerSalons.map((salon) => salon.id);

      const notes = await (this.prisma as any).clientNote.findMany({
        where: {
          userId: clientId,
          salonId: { in: salonIds },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return notes;
    } catch (error) {
      this.logger.error('Error fetching client notes', error);
      throw new HttpException(
        'Failed to fetch client notes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a note for a client
   */
  async createClientNote(
    ownerId: string,
    clientId: string,
    salonId: string,
    note: string,
  ) {
    try {
      // Verify owner owns the salon
      const salon = await this.prisma.salon.findFirst({
        where: {
          id: salonId,
          ownerId,
        },
      });

      if (!salon) {
        throw new HttpException(
          'Salon not found or access denied',
          HttpStatus.FORBIDDEN,
        );
      }

      // Verify client has bookings in this salon
      const hasBooking = await this.prisma.booking.findFirst({
        where: {
          userId: clientId,
          salonId,
        },
      });

      if (!hasBooking) {
        throw new HttpException(
          'Client not found in this salon',
          HttpStatus.NOT_FOUND,
        );
      }

      const clientNote = await (this.prisma as any).clientNote.create({
        data: {
          salonId,
          userId: clientId,
          note,
        },
      });

      return clientNote;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error creating client note', error);
      throw new HttpException(
        'Failed to create client note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update a client note
   */
  async updateClientNote(
    ownerId: string,
    noteId: string,
    note: string,
  ) {
    try {
      // Verify owner owns the salon for this note
      const existingNote = await (this.prisma as any).clientNote.findUnique({
        where: { id: noteId },
        include: {
          Salon: {
            select: {
              ownerId: true,
            },
          },
        },
      });

      if (!existingNote) {
        throw new HttpException('Note not found', HttpStatus.NOT_FOUND);
      }

      if (existingNote.Salon.ownerId !== ownerId) {
        throw new HttpException(
          'Access denied',
          HttpStatus.FORBIDDEN,
        );
      }

      const updatedNote = await (this.prisma as any).clientNote.update({
        where: { id: noteId },
        data: { note },
      });

      return updatedNote;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error updating client note', error);
      throw new HttpException(
        'Failed to update client note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a client note
   */
  async deleteClientNote(ownerId: string, noteId: string) {
    try {
      // Verify owner owns the salon for this note
      const existingNote = await (this.prisma as any).clientNote.findUnique({
        where: { id: noteId },
        include: {
          Salon: {
            select: {
              ownerId: true,
            },
          },
        },
      });

      if (!existingNote) {
        throw new HttpException('Note not found', HttpStatus.NOT_FOUND);
      }

      if (existingNote.Salon.ownerId !== ownerId) {
        throw new HttpException(
          'Access denied',
          HttpStatus.FORBIDDEN,
        );
      }

      await (this.prisma as any).clientNote.delete({
        where: { id: noteId },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Error deleting client note', error);
      throw new HttpException(
        'Failed to delete client note',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

