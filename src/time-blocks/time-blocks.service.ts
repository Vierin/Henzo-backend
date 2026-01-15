import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTimeBlockDto,
  ConflictAction,
} from './dto/create-time-block.dto';
import { UpdateTimeBlockDto } from './dto/update-time-block.dto';

@Injectable()
export class TimeBlocksService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all time blocks for a salon with optional filters
   */
  async getTimeBlocks(
    salonId: string,
    filters?: {
      staffId?: string;
      type?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const where: any = {
      salonId,
    };

    if (filters?.staffId) {
      where.staffId = filters.staffId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    // Filter by date range
    if (filters?.startDate || filters?.endDate) {
      where.AND = [];

      if (filters.startDate) {
        where.AND.push({
          endDate: {
            gte: new Date(filters.startDate),
          },
        });
      }

      if (filters.endDate) {
        where.AND.push({
          startDate: {
            lte: new Date(filters.endDate),
          },
        });
      }
    }

    const timeBlocks = await this.prisma.timeBlock.findMany({
      where,
      orderBy: {
        startDate: 'asc',
      },
    });

    // Fetch staff info for each block
    const blocksWithStaff = await Promise.all(
      timeBlocks.map(async (block) => {
        let staff: { id: string; name: string; email: string | null } | null =
          null;
        if (block.staffId) {
          staff = await this.prisma.staff.findUnique({
            where: { id: block.staffId },
            select: {
              id: true,
              name: true,
              email: true,
            },
          });
        }
        return {
          ...block,
          staff,
        };
      }),
    );

    return blocksWithStaff;
  }

  /**
   * Get a single time block by ID
   */
  async getTimeBlock(id: string, salonId: string) {
    const timeBlock = await this.prisma.timeBlock.findFirst({
      where: {
        id,
        salonId,
      },
    });

    if (!timeBlock) {
      throw new NotFoundException('Time block not found');
    }

    // Fetch staff info if staffId exists
    let staff: { id: string; name: string; email: string | null } | null = null;
    if (timeBlock.staffId) {
      staff = await this.prisma.staff.findUnique({
        where: { id: timeBlock.staffId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    }

    return {
      ...timeBlock,
      staff,
    };
  }

  /**
   * Check for conflicting bookings
   */
  async checkConflicts(salonId: string, data: CreateTimeBlockDto) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Build where clause for bookings
    const where: any = {
      salonId,
      dateTime: {
        gte: startDate,
        lt: endDate,
      },
      status: {
        in: ['PENDING', 'CONFIRMED'],
      },
    };

    // If staffId is provided, only check that staff's bookings
    if (data.staffId) {
      where.staffId = data.staffId;
    }

    const conflictingBookings = await this.prisma.booking.findMany({
      where,
      include: {
        Service: {
          select: {
            name: true,
          },
        },
        User: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        dateTime: 'asc',
      },
    });

    return conflictingBookings.map((booking) => ({
      id: booking.id,
      time: booking.dateTime,
      userId: booking.userId,
      user: booking.User,
      service: booking.Service,
    }));
  }

  /**
   * Create a new time block
   */
  async createTimeBlock(salonId: string, data: CreateTimeBlockDto) {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    // Validate dates
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for conflicting bookings
    const conflictingBookings = await this.checkConflicts(salonId, data);

    // Handle conflicts based on action
    if (conflictingBookings.length > 0) {
      if (data.conflictAction === ConflictAction.CANCEL) {
        // Cancel all conflicting bookings
        await this.prisma.booking.updateMany({
          where: {
            id: {
              in: conflictingBookings.map((b) => b.id),
            },
          },
          data: {
            status: 'CANCELED',
          },
        });

        console.log(
          `✅ Cancelled ${conflictingBookings.length} conflicting bookings`,
        );
      } else if (
        data.conflictAction === ConflictAction.RESCHEDULE &&
        data.rescheduleStaffId
      ) {
        // Move conflicting bookings to another staff member
        await this.prisma.booking.updateMany({
          where: {
            id: {
              in: conflictingBookings.map((b) => b.id),
            },
          },
          data: {
            staffId: data.rescheduleStaffId,
          },
        });

        console.log(
          `✅ Rescheduled ${conflictingBookings.length} conflicting bookings to staff ${data.rescheduleStaffId}`,
        );
      } else if (data.conflictAction === ConflictAction.KEEP) {
        // Legacy behavior: keep conflicting bookings, just show warning
        console.log(
          `⚠️ Keeping ${conflictingBookings.length} conflicting bookings (legacy KEEP action)`,
        );
      }
    }

    // Generate unique ID
    const id = this.generateId();

    // Create the time block
    const timeBlock = await this.prisma.timeBlock.create({
      data: {
        id,
        salonId,
        staffId: data.staffId || null,
        type: data.type,
        reason: data.reason || null,
        startDate,
        endDate,
        updatedAt: new Date(),
        notes: data.notes,
        conflictAction: data.conflictAction,
        rescheduleStaffId: data.rescheduleStaffId || null,
      },
    });

    // Fetch staff info if staffId exists
    let staff: { id: string; name: string; email: string | null } | null = null;
    if (timeBlock.staffId) {
      staff = await this.prisma.staff.findUnique({
        where: { id: timeBlock.staffId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    }

    // Return with conflicting bookings info
    return {
      ...timeBlock,
      staff,
      conflictingBookings:
        data.conflictAction === ConflictAction.CANCEL ||
        data.conflictAction === ConflictAction.RESCHEDULE
          ? []
          : conflictingBookings, // Show conflicts for KEEP action (legacy)
    };
  }

  /**
   * Update a time block
   */
  async updateTimeBlock(id: string, salonId: string, data: UpdateTimeBlockDto) {
    // Check if time block exists
    await this.getTimeBlock(id, salonId);

    const updateData: any = {};

    if (data.type) updateData.type = data.type;
    if (data.reason) updateData.reason = data.reason;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.conflictAction) updateData.conflictAction = data.conflictAction;
    if (data.rescheduleStaffId !== undefined)
      updateData.rescheduleStaffId = data.rescheduleStaffId;

    // Validate dates if both are being updated
    if (updateData.startDate && updateData.endDate) {
      if (updateData.endDate <= updateData.startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const timeBlock = await this.prisma.timeBlock.update({
      where: { id },
      data: updateData,
    });

    // Fetch staff info if staffId exists
    let staff: { id: string; name: string; email: string | null } | null = null;
    if (timeBlock.staffId) {
      staff = await this.prisma.staff.findUnique({
        where: { id: timeBlock.staffId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });
    }

    return {
      ...timeBlock,
      staff,
    };
  }

  /**
   * Delete a time block
   */
  async deleteTimeBlock(id: string, salonId: string) {
    // Check if time block exists
    await this.getTimeBlock(id, salonId);

    await this.prisma.timeBlock.delete({
      where: { id },
    });

    return { message: 'Time block deleted successfully' };
  }

  /**
   * Check if a time slot is blocked
   */
  async isTimeSlotBlocked(
    salonId: string,
    staffId: string | null,
    dateTime: Date,
  ): Promise<boolean> {
    const where: any = {
      salonId,
      startDate: {
        lte: dateTime,
      },
      endDate: {
        gte: dateTime,
      },
    };

    // Check salon-wide blocks or staff-specific blocks
    if (staffId) {
      where.OR = [{ staffId: null }, { staffId }];
    } else {
      where.staffId = null;
    }

    const blockingTimeBlock = await this.prisma.timeBlock.findFirst({
      where,
    });

    return !!blockingTimeBlock;
  }

  /**
   * Generate unique ID (similar to cuid)
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(12).toString('base64url');
    return `${timestamp}${randomPart}`.substring(0, 25);
  }
}
