import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    salonId: string;
    userId: string;
    bookingId?: string;
    rating: number;
    comment?: string;
  }) {
    return this.prisma.review.create({
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
          },
        },
        booking: {
          select: {
            id: true,
            service: {
              select: {
                name: true,
              },
            },
            time: true,
          },
        },
      },
    });
  }

  async findBySalonId(salonId: string) {
    return this.prisma.review.findMany({
      where: { salonId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        booking: {
          select: {
            id: true,
            service: {
              select: {
                name: true,
              },
            },
            time: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.review.findMany({
      where: { userId },
      include: {
        salon: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
          },
        },
        booking: {
          select: {
            id: true,
            service: {
              select: {
                name: true,
              },
            },
            time: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getSalonStats(salonId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { salonId },
      select: {
        rating: true,
      },
    });

    const totalReviews = reviews.length;
    const averageRating =
      totalReviews > 0
        ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
        : 0;

    const ratingDistribution = {
      5: reviews.filter((r) => r.rating === 5).length,
      4: reviews.filter((r) => r.rating === 4).length,
      3: reviews.filter((r) => r.rating === 3).length,
      2: reviews.filter((r) => r.rating === 2).length,
      1: reviews.filter((r) => r.rating === 1).length,
    };

    return {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      ratingDistribution,
    };
  }

  async update(id: string, data: { rating?: number; comment?: string }) {
    return this.prisma.review.update({
      where: { id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        salon: {
          select: {
            id: true,
            name: true,
          },
        },
        booking: {
          select: {
            id: true,
            service: {
              select: {
                name: true,
              },
            },
            time: true,
          },
        },
      },
    });
  }

  async delete(id: string) {
    return this.prisma.review.delete({
      where: { id },
    });
  }
}
