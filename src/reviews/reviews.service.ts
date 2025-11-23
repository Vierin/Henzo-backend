import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async createReview(data: CreateReviewDto, userId: string) {
    try {
      console.log('📝 Creating review:', { data, userId });

      // Check if user has already reviewed this salon
      const existingReview = await this.prisma.review.findFirst({
        where: {
          userId: userId,
          salonId: data.salonId,
          bookingId: data.bookingId || null,
        },
      });

      if (existingReview) {
        throw new Error('You have already reviewed this salon');
      }

      // Create review
      const review = await this.prisma.review.create({
        data: {
          salonId: data.salonId,
          userId: userId,
          bookingId: data.bookingId,
          rating: data.rating,
          comment: data.comment,
        },
        include: {
          Salon: true,
          Booking: {
            include: {
              Service: true,
            },
          },
        },
      });

      console.log('✅ Review created successfully:', review.id);
      return review;
    } catch (error) {
      console.error('❌ Error creating review:', error.message);
      throw error;
    }
  }

  async getUserReviews(userId: string) {
    try {
      const reviews = await this.prisma.review.findMany({
        where: {
          userId: userId,
        },
        include: {
          Salon: true,
          Booking: {
            include: {
              Service: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return reviews;
    } catch (error) {
      console.error('❌ Error fetching user reviews:', error.message);
      throw error;
    }
  }

  async updateReview(reviewId: string, data: UpdateReviewDto, userId: string) {
    try {
      console.log('📝 Updating review:', { reviewId, data, userId });

      // Check if review exists and belongs to user
      const existingReview = await this.prisma.review.findFirst({
        where: {
          id: reviewId,
          userId: userId,
        },
      });

      if (!existingReview) {
        throw new Error(
          'Review not found or you do not have permission to update it',
        );
      }

      // Update review
      const review = await this.prisma.review.update({
        where: {
          id: reviewId,
        },
        data: {
          rating: data.rating,
          comment: data.comment,
        },
        include: {
          Salon: true,
          Booking: {
            include: {
              Service: true,
            },
          },
        },
      });

      console.log('✅ Review updated successfully:', review.id);
      return review;
    } catch (error) {
      console.error('❌ Error updating review:', error.message);
      throw error;
    }
  }

  async deleteReview(reviewId: string, userId: string) {
    try {
      console.log('📝 Deleting review:', { reviewId, userId });

      // Check if review exists and belongs to user
      const existingReview = await this.prisma.review.findFirst({
        where: {
          id: reviewId,
          userId: userId,
        },
      });

      if (!existingReview) {
        throw new Error(
          'Review not found or you do not have permission to delete it',
        );
      }

      // Delete review
      await this.prisma.review.delete({
        where: {
          id: reviewId,
        },
      });

      console.log('✅ Review deleted successfully:', reviewId);
      return true;
    } catch (error) {
      console.error('❌ Error deleting review:', error.message);
      throw error;
    }
  }
}
