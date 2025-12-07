import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async savePushToken(
    userId: string,
    token: string,
    platform: string,
  ): Promise<void> {
    try {
      // Deactivate old tokens for this user on the same platform
      await this.prisma.pushToken.updateMany({
        where: {
          userId,
          platform,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Check if token already exists
      const existingToken = await this.prisma.pushToken.findUnique({
        where: { token },
      });

      if (existingToken) {
        // Update existing token
        await this.prisma.pushToken.update({
          where: { token },
          data: {
            userId,
            platform,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        // Create new token
        await this.prisma.pushToken.create({
          data: {
            userId,
            token,
            platform,
            isActive: true,
          },
        });
      }

      console.log('✅ Push token saved successfully:', { userId, platform });
    } catch (error) {
      console.error('❌ Error saving push token:', error);
      throw error;
    }
  }

  async getPushTokensByUserId(userId: string): Promise<string[]> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          token: true,
        },
      });

      return tokens.map((t) => t.token);
    } catch (error) {
      console.error('❌ Error getting push tokens:', error);
      return [];
    }
  }

  async getPushTokensBySalonOwner(salonId: string): Promise<string[]> {
    try {
      // Find salon owner
      const salon = await this.prisma.salon.findUnique({
        where: { id: salonId },
        select: {
          ownerId: true,
        },
      });

      if (!salon) {
        return [];
      }

      return this.getPushTokensByUserId(salon.ownerId);
    } catch (error) {
      console.error('❌ Error getting push tokens for salon owner:', error);
      return [];
    }
  }

  async sendPushNotification(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    try {
      if (tokens.length === 0) {
        console.log('⚠️ No push tokens available');
        return;
      }

      // Use Expo Push Notification API
      const messages = tokens.map((token) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        badge: 1,
        // Android-specific: use bookings channel for booking notifications
        channelId: data?.type === 'NEW_BOOKING' ? 'bookings' : 'default',
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Failed to send push notification:', error);
        throw new Error('Failed to send push notification');
      }

      const result = await response.json();
      console.log('✅ Push notifications sent:', result);
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
      throw error;
    }
  }

  async sendBookingNotification(
    salonId: string,
    bookingId: string,
    clientName: string,
    serviceName: string,
    dateTime: Date,
  ): Promise<void> {
    try {
      const tokens = await this.getPushTokensBySalonOwner(salonId);

      if (tokens.length === 0) {
        console.log('⚠️ No push tokens found for salon owner');
        return;
      }

      const title = 'New Booking Request';
      const body = `${clientName} requested ${serviceName}`;
      const formattedDate = new Date(dateTime).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      await this.sendPushNotification(tokens, title, body, {
        type: 'NEW_BOOKING',
        bookingId,
        salonId,
        clientName,
        serviceName,
        dateTime: dateTime.toISOString(),
        formattedDate,
      });

      console.log('✅ Booking notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending booking notification:', error);
      // Don't throw - we don't want to fail booking creation if notification fails
    }
  }
}
