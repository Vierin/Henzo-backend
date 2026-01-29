import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all clients for a salon owner
   * Returns unique clients with aggregated stats
   */
  async getClients(ownerId: string, options?: { search?: string }) {
    try {
      // Find all salons owned by this owner
      const ownerSalons = await this.prisma.salon.findMany({
        where: { ownerId },
        select: { id: true },
      });

      if (ownerSalons.length === 0) {
        return [];
      }

      const salonIds = ownerSalons.map((salon) => salon.id);

      // Get all bookings for these salons
      const bookings = await this.prisma.booking.findMany({
        where: {
          salonId: { in: salonIds },
        },
        select: {
          userId: true,
          dateTime: true,
          status: true,
          Service: {
            select: {
              price: true,
            },
          },
          User: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true,
            },
          },
        },
      });

      // Group by userId and calculate stats
      const clientMap = new Map<
        string,
        {
          id: string;
          name: string | null;
          email: string;
          phone: string | null;
          createdAt: Date;
          totalSpent: number;
          visitCount: number;
          lastVisit: Date | null;
          completedVisits: number;
        }
      >();

      for (const booking of bookings) {
        const userId = booking.userId;
        const user = booking.User;

        if (!clientMap.has(userId)) {
          clientMap.set(userId, {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            createdAt: user.createdAt,
            totalSpent: 0,
            visitCount: 0,
            lastVisit: null,
            completedVisits: 0,
          });
        }

        const client = clientMap.get(userId)!;
        client.visitCount++;

        if (booking.status === 'COMPLETED') {
          client.totalSpent += booking.Service.price;
          client.completedVisits++;
        }

        if (!client.lastVisit || booking.dateTime > client.lastVisit) {
          client.lastVisit = booking.dateTime;
        }
      }

      let clients = Array.from(clientMap.values());

      // Apply search filter if provided
      if (options?.search) {
        const searchLower = options.search.toLowerCase();
        clients = clients.filter(
          (client) =>
            client.name?.toLowerCase().includes(searchLower) ||
            client.email.toLowerCase().includes(searchLower) ||
            client.phone?.toLowerCase().includes(searchLower),
        );
      }

      // Sort by last visit (most recent first), then by name
      clients.sort((a, b) => {
        if (a.lastVisit && b.lastVisit) {
          return b.lastVisit.getTime() - a.lastVisit.getTime();
        }
        if (a.lastVisit) return -1;
        if (b.lastVisit) return 1;
        return (a.name || a.email).localeCompare(b.name || b.email);
      });

      return clients;
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

      const notes = await this.prisma.clientNote.findMany({
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

      const clientNote = await this.prisma.clientNote.create({
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
      const existingNote = await this.prisma.clientNote.findUnique({
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

      const updatedNote = await this.prisma.clientNote.update({
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
      const existingNote = await this.prisma.clientNote.findUnique({
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

      await this.prisma.clientNote.delete({
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

