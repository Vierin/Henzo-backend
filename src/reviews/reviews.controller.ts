import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { AuthService } from '../auth/auth.service';

@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly authService: AuthService,
  ) {}

  @Get('user')
  async getUserReviews(@Headers('authorization') authHeader: string) {
    try {
      console.log('📝 Fetching user reviews:', {
        hasAuthHeader: !!authHeader,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for fetching reviews:',
        currentUser.user.email,
      );

      const reviews = await this.reviewsService.getUserReviews(
        currentUser.user.id,
      );

      console.log('✅ User reviews fetched successfully:', reviews.length);
      return reviews;
    } catch (error) {
      console.error('❌ Fetch user reviews failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to fetch user reviews',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post()
  async createReview(
    @Body() data: CreateReviewDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 Creating review:', {
        hasAuthHeader: !!authHeader,
        salonId: data.salonId,
        rating: data.rating,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for creating review:',
        currentUser.user.email,
      );

      const review = await this.reviewsService.createReview(
        data,
        currentUser.user.id,
      );

      console.log('✅ Review created successfully:', review.id);
      return {
        success: true,
        review,
      };
    } catch (error) {
      console.error('❌ Create review failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to create review',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async updateReview(
    @Param('id') id: string,
    @Body() data: UpdateReviewDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 Updating review:', {
        hasAuthHeader: !!authHeader,
        reviewId: id,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for updating review:',
        currentUser.user.email,
      );

      const review = await this.reviewsService.updateReview(
        id,
        data,
        currentUser.user.id,
      );

      console.log('✅ Review updated successfully:', review.id);
      return {
        success: true,
        review,
      };
    } catch (error) {
      console.error('❌ Update review failed:', error.message);
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
      console.log('📝 Deleting review:', {
        hasAuthHeader: !!authHeader,
        reviewId: id,
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log(
        '✅ User authenticated for deleting review:',
        currentUser.user.email,
      );

      await this.reviewsService.deleteReview(id, currentUser.user.id);

      console.log('✅ Review deleted successfully:', id);
      return {
        success: true,
        message: 'Review deleted successfully',
      };
    } catch (error) {
      console.error('❌ Delete review failed:', error.message);
      throw new HttpException(
        error.message || 'Failed to delete review',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
