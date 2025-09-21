import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async createReview(
    @Headers('authorization') authHeader: string,
    @Body()
    data: {
      salonId: string;
      bookingId?: string;
      rating: number;
      comment?: string;
    },
  ) {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header provided');
      }

      // Extract user ID from token (you'll need to implement this)
      const userId = 'user-id-from-token'; // TODO: Extract from JWT token

      const review = await this.reviewsService.create({
        ...data,
        userId,
      });

      return review;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create review',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('salon/:salonId')
  async getSalonReviews(@Param('salonId') salonId: string) {
    try {
      const reviews = await this.reviewsService.findBySalonId(salonId);
      return reviews;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get salon reviews',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('salon/:salonId/stats')
  async getSalonStats(@Param('salonId') salonId: string) {
    try {
      const stats = await this.reviewsService.getSalonStats(salonId);
      return stats;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get salon stats',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('user')
  async getUserReviews(@Headers('authorization') authHeader: string) {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header provided');
      }

      // Extract user ID from token (you'll need to implement this)
      const userId = 'user-id-from-token'; // TODO: Extract from JWT token

      const reviews = await this.reviewsService.findByUserId(userId);
      return reviews;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get user reviews',
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  @Put(':id')
  async updateReview(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Body() data: { rating?: number; comment?: string },
  ) {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header provided');
      }

      const review = await this.reviewsService.update(id, data);
      return review;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update review',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async deleteReview(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('No authorization header provided');
      }

      await this.reviewsService.delete(id);
      return { message: 'Review deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete review',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
