import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { FirebaseAdminService } from './firebase-admin.service';
import { getNotificationText } from './notification-translations';

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private firebaseAdmin: FirebaseAdminService,
  ) {}

  async savePushToken(
    userId: string,
    token: string,
    platform: string,
    language: string = 'en',
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
            language,
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
            language,
            isActive: true,
          },
        });
      }

      console.log('✅ Push token saved successfully:', { userId, platform, language });
    } catch (error) {
      console.error('❌ Error saving push token:', error);
      throw error;
    }
  }

  /** Send test notification to user (for debugging). Uses channel henzo_default on Android. */
  async sendTestPush(userId: string): Promise<void> {
    const tokens = await this.getPushTokensByUserId(userId);
    console.log(`[Push] test-push: user=${userId} tokens=${tokens.length}`);
    if (tokens.length === 0) {
      console.warn('[Push] test-push: no tokens for user, register from app first');
      throw new Error('No push tokens for this user. Open the app and log in to register a token.');
    }
    await this.sendPushNotification(
      tokens,
      'Henzo Test',
      'If you see this, push works',
      { type: 'TEST' },
      undefined,
      'henzo_default',
    );
    console.log('[Push] test-push sent');
  }

  async getPushTokensByUserId(userId: string): Promise<Array<{ token: string; language: string }>> {
    try {
      const tokens = await this.prisma.pushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: {
          token: true,
          language: true,
        },
      });

      return tokens.map((t) => ({
        token: t.token,
        language: t.language || 'en',
      }));
    } catch (error) {
      console.error('❌ Error getting push tokens:', error);
      return [];
    }
  }

  async getPushTokensBySalonOwner(salonId: string): Promise<Array<{ token: string; language: string }>> {
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
    tokens: Array<{ token: string; language: string }> | string[],
    title: string,
    body: string,
    data?: Record<string, any>,
    actions?: Array<{ action: string; title: string }>,
    androidChannelId?: string,
  ): Promise<void> {
    try {
      console.log(`📤 Sending push notification to ${tokens.length} token(s)`);
      console.log(`   Title: ${title}`);
      console.log(`   Body: ${body}`);
      console.log(`   Data:`, data);
      
      if (tokens.length === 0) {
        console.log('⚠️ No push tokens available');
        return;
      }

      // Normalize tokens to array of objects
      const tokenObjects: Array<{ token: string; language: string }> = tokens.map((t) => {
        if (typeof t === 'string') {
          return { token: t, language: 'en' };
        }
        return t;
      });

      // Separate Expo tokens and FCM/APNs tokens
      const expoTokens: Array<{ token: string; language: string }> = [];
      const nativeTokens: Array<{ token: string; language: string }> = [];

      tokenObjects.forEach((tokenObj) => {
        // Expo tokens start with ExponentPushToken or ExpoPushToken
        if (tokenObj.token.startsWith('ExponentPushToken[') || tokenObj.token.startsWith('ExpoPushToken')) {
          expoTokens.push(tokenObj);
        } else {
          // Native tokens (FCM/APNs) - any other format
          nativeTokens.push(tokenObj);
        }
      });

      console.log(`📱 Token types: ${expoTokens.length} Expo, ${nativeTokens.length} Native (FCM/APNs)`);

      // Send Expo tokens via Expo API
      if (expoTokens.length > 0) {
        console.log(`📤 Sending ${expoTokens.length} Expo token(s) via Expo API...`);
        try {
          const messages = expoTokens.map((tokenObj) => ({
            to: tokenObj.token,
            sound: 'default',
            title,
            body,
            data: data || {},
            badge: 1,
            // Android-specific: use bookings channel for booking notifications
            channelId: data?.type === 'NEW_BOOKING' ? 'bookings' : 'default',
          }));

          console.log(`📤 Sending to Expo API:`, JSON.stringify(messages, null, 2));

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
            console.error('❌ Failed to send Expo push notification:', error);
            throw new Error('Failed to send Expo push notification');
          }

          const result = await response.json();
          console.log('✅ Expo push notifications sent:', JSON.stringify(result, null, 2));

          // Check for errors in response
          if (result.data && Array.isArray(result.data)) {
            result.data.forEach((item: any, index: number) => {
              if (item.status === 'error') {
                console.error(
                  `❌ Expo push notification error for token ${index}:`,
                  item.message,
                );
                if (item.message?.includes('FCM server key')) {
                  console.error(
                    '⚠️ FCM Server Key not configured in Expo. For Android production, you need to:',
                  );
                  console.error(
                    '   1. Get FCM Server Key from Firebase Console',
                  );
                  console.error(
                    '   2. Configure it in Expo Dashboard or via EAS CLI',
                  );
                  console.error(
                    '   3. See apps/mobile/FIREBASE_SETUP.md for details',
                  );
                }
              }
            });
          }
        } catch (error) {
          console.error('❌ Error sending Expo push notifications:', error);
          // Don't throw, try Firebase Admin as fallback if available
        }
      }

      // Send native tokens (FCM/APNs) via Firebase Admin
      if (nativeTokens.length > 0) {
        console.log(`📤 Sending ${nativeTokens.length} native token(s) (FCM/APNs) via Firebase Admin...`);
        if (this.firebaseAdmin.isInitialized()) {
          try {
            const channelId = androidChannelId ?? 'henzo_default';
            console.log(`[Push] FCM channelId: ${channelId}`);
            const response = await this.firebaseAdmin.sendMulticast(
              nativeTokens.map(t => t.token),
              { title, body },
              data
                ? Object.keys(data).reduce((acc, key) => {
                    acc[key] = String(data[key]);
                    return acc;
                  }, {} as Record<string, string>)
                : undefined,
              {
                channelId,
                priority: 'high',
                actions,
              },
            );
            console.log(
              `✅ Native push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`,
            );
            if (response.failureCount > 0) {
              response.responses.forEach((resp, index) => {
                if (!resp.success) {
                  console.error(`❌ Native token ${index} failed:`, resp.error);
                }
              });
            }
          } catch (error) {
            console.error('❌ Error sending native push notifications:', error);
            throw error;
          }
        } else {
          console.warn(
            '⚠️ Firebase Admin not initialized. Native tokens (FCM/APNs) cannot be sent.',
          );
          console.warn(
            '   Set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH environment variable',
          );
        }
      }
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
    bookingStatus: 'PENDING' | 'CONFIRMED' = 'PENDING',
  ): Promise<void> {
    try {
      const isInformational = bookingStatus === 'CONFIRMED';
      console.log(`📤 Preparing to send booking notification for salon: ${salonId} (${isInformational ? 'informational' : 'request to confirm'})`);
      const tokens = await this.getPushTokensBySalonOwner(salonId);

      console.log(`📱 Found ${tokens.length} push token(s) for salon owner`);
      if (tokens.length > 0) {
        console.log(`📱 Tokens:`, tokens.map(t => t.token.substring(0, 30) + '...'));
      }

      if (tokens.length === 0) {
        console.log('⚠️ No push tokens found for salon owner');
        return;
      }

      // Group tokens by language
      const tokensByLanguage = new Map<string, Array<{ token: string; language: string }>>();
      tokens.forEach((tokenObj) => {
        const lang = tokenObj.language || 'en';
        if (!tokensByLanguage.has(lang)) {
          tokensByLanguage.set(lang, []);
        }
        tokensByLanguage.get(lang)!.push(tokenObj);
      });

      // Send notification for each language group
      for (const [language, languageTokens] of tokensByLanguage.entries()) {
        const locale = language === 'ru' ? 'ru-RU' : language === 'vi' ? 'vi-VN' : 'en-US';
        const formattedDateStr = new Date(dateTime).toLocaleString(locale, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        const title = isInformational
          ? getNotificationText(language, 'newBookingConfirmed')
          : getNotificationText(language, 'newBookingRequest');
        const verbText = isInformational
          ? getNotificationText(language, 'booked')
          : getNotificationText(language, 'requested');
        const body = `${verbText} ${serviceName}`;

        // Only show confirm/reject actions when booking is PENDING
        const actions = isInformational
          ? undefined
          : [
              { action: 'CONFIRM_BOOKING', title: '✓' },
              { action: 'REJECT_BOOKING', title: '✕' },
            ];

        console.log(`📤 Sending booking notification (${language}):`, { title, body, bookingId, isInformational });

        await this.sendPushNotification(
          languageTokens,
          title,
          body,
          {
            type: 'NEW_BOOKING',
            bookingId,
            salonId,
            clientName,
            serviceName,
            dateTime: dateTime.toISOString(),
            formattedDate: formattedDateStr,
          },
          actions,
          'henzo_default',
        );
      }

      console.log('✅ Booking notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending booking notification:', error);
      // Don't throw - we don't want to fail booking creation if notification fails
    }
  }

  async sendBookingCancellationNotification(
    salonId: string,
    bookingId: string,
    clientName: string,
    serviceName: string,
    dateTime: Date,
  ): Promise<void> {
    try {
      console.log(`📤 Preparing to send booking cancellation notification for salon: ${salonId}`);
      const tokens = await this.getPushTokensBySalonOwner(salonId);

      console.log(`📱 Found ${tokens.length} push token(s) for salon owner`);
      if (tokens.length > 0) {
        console.log(`📱 Tokens:`, tokens.map(t => t.token.substring(0, 30) + '...'));
      }

      if (tokens.length === 0) {
        console.log('⚠️ No push tokens found for salon owner');
        return;
      }

      // Group tokens by language
      const tokensByLanguage = new Map<string, Array<{ token: string; language: string }>>();
      tokens.forEach((tokenObj) => {
        const lang = tokenObj.language || 'en';
        if (!tokensByLanguage.has(lang)) {
          tokensByLanguage.set(lang, []);
        }
        tokensByLanguage.get(lang)!.push(tokenObj);
      });

      // Send notification for each language group
      for (const [language, languageTokens] of tokensByLanguage.entries()) {
        const title = getNotificationText(language, 'bookingCancelled');
        const cancelledByText = getNotificationText(language, 'cancelledBy');
        const body = `${cancelledByText} ${clientName}. ${serviceName}`;

        const formattedDate = new Date(dateTime).toLocaleString(language === 'ru' ? 'ru-RU' : language === 'vi' ? 'vi-VN' : 'en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        console.log(`📤 Sending booking cancellation notification (${language}):`, { title, body, bookingId, dateTime });

        await this.sendPushNotification(languageTokens, title, body, {
          type: 'BOOKING_CANCELLED',
          bookingId,
          salonId,
          clientName,
          serviceName,
          dateTime: dateTime.toISOString(),
          formattedDate,
        });
      }

      console.log('✅ Booking cancellation notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending booking cancellation notification:', error);
      // Don't throw - we don't want to fail booking cancellation if notification fails
    }
  }
}
