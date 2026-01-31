import {
	Controller,
	Get,
	Post,
	Put,
	Delete,
	Param,
	Body,
	Query,
	Headers,
	HttpException,
	HttpStatus,
} from '@nestjs/common';
import { TimeBlocksService } from './time-blocks.service';
import { CreateTimeBlockDto } from './dto/create-time-block.dto';
import { UpdateTimeBlockDto } from './dto/update-time-block.dto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('time-blocks')
export class TimeBlocksController {
	constructor(
		private readonly timeBlocksService: TimeBlocksService,
		private readonly authService: AuthService,
		private readonly prisma: PrismaService,
	) {}

  /**
   * Get all time blocks for current user's salon
   */
  @Get()
  async getTimeBlocks(
    @Headers('authorization') authHeader: string,
    @Query('staffId') staffId?: string,
    @Query('type') type?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
			const currentUser = await this.authService.getCurrentUser(authHeader);

			// Get user's salon
			const userSalon = await this.prisma.salon.findFirst({
				where: { ownerId: currentUser.user.id },
				select: { id: true },
			});

      if (!userSalon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      const timeBlocks = await this.timeBlocksService.getTimeBlocks(
        userSalon.id,
        {
          staffId,
          type,
          startDate,
          endDate,
        },
      );

      return timeBlocks;
    } catch (error) {
      console.error('❌ Fetch time blocks failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch time blocks',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get a single time block by ID
   */
  @Get(':id')
  async getTimeBlock(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const userSalon = await this.prisma.salon.findFirst({
        where: { ownerId: currentUser.user.id },
        select: { id: true },
      });

      if (!userSalon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      const timeBlock = await this.timeBlocksService.getTimeBlock(
        id,
        userSalon.id,
      );

      return timeBlock;
    } catch (error) {
      console.error('❌ Fetch time block failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch time block',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Check for conflicts without creating block
   */
  @Post('check-conflicts')
  async checkConflicts(
    @Body() data: CreateTimeBlockDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const userSalon = await this.prisma.salon.findFirst({
        where: { ownerId: currentUser.user.id },
        select: { id: true },
      });

      if (!userSalon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      const conflicts = await this.timeBlocksService.checkConflicts(
        userSalon.id,
        data,
      );

      // Return a mock TimeBlock structure with conflicts
      return {
        id: 'temp-id',
        salonId: userSalon.id,
        staffId: data.staffId || null,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        notes: data.notes,
        conflictAction: data.conflictAction,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        conflictingBookings: conflicts,
      };
    } catch (error) {
      console.error('❌ Check conflicts failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to check conflicts',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Create a new time block
   */
  @Post()
  async createTimeBlock(
    @Body() data: CreateTimeBlockDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('🚫 Creating time block:', data);

      const currentUser = await this.authService.getCurrentUser(authHeader);

      const userSalon = await this.prisma.salon.findFirst({
        where: { ownerId: currentUser.user.id },
        select: { id: true },
      });

      if (!userSalon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      // Validate staffId if provided
      if (data.staffId) {
        const staff = await this.prisma.staff.findFirst({
          where: {
            id: data.staffId,
            salonId: userSalon.id,
          },
        });

        if (!staff) {
          throw new HttpException(
            'Staff member not found',
            HttpStatus.NOT_FOUND,
          );
        }
      }

      const timeBlock = await this.timeBlocksService.createTimeBlock(
        userSalon.id,
        data,
      );

      console.log('✅ Time block created successfully:', timeBlock.id);
      return timeBlock;
    } catch (error) {
      console.error('❌ Create time block failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to create time block',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Update a time block
   */
  @Put(':id')
  async updateTimeBlock(
    @Param('id') id: string,
    @Body() data: UpdateTimeBlockDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const userSalon = await this.prisma.salon.findFirst({
        where: { ownerId: currentUser.user.id },
        select: { id: true },
      });

      if (!userSalon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      const timeBlock = await this.timeBlocksService.updateTimeBlock(
        id,
        userSalon.id,
        data,
      );

      console.log('✅ Time block updated successfully:', timeBlock.id);
      return timeBlock;
    } catch (error) {
      console.error('❌ Update time block failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to update time block',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Delete a time block
   */
  @Delete(':id')
  async deleteTimeBlock(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      const userSalon = await this.prisma.salon.findFirst({
        where: { ownerId: currentUser.user.id },
        select: { id: true },
      });

      if (!userSalon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      const result = await this.timeBlocksService.deleteTimeBlock(
        id,
        userSalon.id,
      );

      console.log('✅ Time block deleted successfully:', id);
      return result;
    } catch (error) {
      console.error('❌ Delete time block failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to delete time block',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}
