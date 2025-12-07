import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app: admin.app.App | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    this.logger.log('🔧 Initializing Firebase Admin SDK...');
    
    try {
      // Check if Firebase is already initialized
      if (admin.apps.length > 0) {
        this.app = admin.app();
        this.logger.log('✅ Firebase Admin already initialized');
        return;
      }

      // Try to get service account from environment
      this.logger.log('📋 Checking FIREBASE_SERVICE_ACCOUNT environment variable...');
      const serviceAccountJson = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT',
      );

      if (serviceAccountJson) {
        this.logger.log(`📋 FIREBASE_SERVICE_ACCOUNT found (length: ${serviceAccountJson.length} chars)`);
        try {
          const serviceAccount = JSON.parse(serviceAccountJson);
          this.logger.log(`📋 Parsed Service Account JSON, project_id: ${serviceAccount.project_id || 'N/A'}`);
          this.app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          this.logger.log('✅ Firebase Admin initialized with Service Account (from env variable)');
          return;
        } catch (error) {
          this.logger.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', error);
          this.logger.warn('⚠️ Trying file path instead...');
        }
      } else {
        this.logger.log('⚠️ FIREBASE_SERVICE_ACCOUNT not found in environment');
      }

      // Try to get service account file path
      this.logger.log('📋 Checking FIREBASE_SERVICE_ACCOUNT_PATH environment variable...');
      const serviceAccountPath = this.configService.get<string>(
        'FIREBASE_SERVICE_ACCOUNT_PATH',
      );

      if (serviceAccountPath) {
        this.logger.log(`📋 FIREBASE_SERVICE_ACCOUNT_PATH found: ${serviceAccountPath}`);
        try {
          const fs = require('fs');
          const path = require('path');
          
          // Try multiple path resolutions
          const pathsToTry = [
            path.resolve(process.cwd(), serviceAccountPath),
            path.resolve(__dirname, '../../', serviceAccountPath),
            path.resolve(__dirname, '../../../', serviceAccountPath),
            serviceAccountPath, // Try as absolute path
          ];
          
          let fullPath: string | null = null;
          for (const tryPath of pathsToTry) {
            this.logger.log(`📋 Trying path: ${tryPath}`);
            if (fs.existsSync(tryPath)) {
              fullPath = tryPath;
              this.logger.log(`✅ Service Account file found at: ${fullPath}`);
              break;
            }
          }
          
          if (fullPath) {
            this.app = admin.initializeApp({
              credential: admin.credential.cert(fullPath),
            });
            this.logger.log(
              `✅ Firebase Admin initialized with Service Account file: ${fullPath}`,
            );
            return;
          } else {
            this.logger.error(`❌ Service Account file not found. Tried paths:`);
            pathsToTry.forEach(p => this.logger.error(`   - ${p}`));
          }
        } catch (error) {
          this.logger.error('❌ Failed to load Service Account file:', error);
          if (error instanceof Error) {
            this.logger.error(`   Error: ${error.message}`);
          }
        }
      } else {
        this.logger.log('⚠️ FIREBASE_SERVICE_ACCOUNT_PATH not found in environment');
        // Try default path
        const fs = require('fs');
        const path = require('path');
        const defaultPath = path.resolve(process.cwd(), 'config/firebase-service-account.json');
        this.logger.log(`📋 Trying default path: ${defaultPath}`);
        if (fs.existsSync(defaultPath)) {
          this.logger.log('✅ Found Service Account file at default location');
          try {
            this.app = admin.initializeApp({
              credential: admin.credential.cert(defaultPath),
            });
            this.logger.log(
              `✅ Firebase Admin initialized with Service Account file: ${defaultPath}`,
            );
            return;
          } catch (error) {
            this.logger.error('❌ Failed to initialize with default path:', error);
          }
        }
      }

      // Try to use default credentials (for Google Cloud environments)
      this.logger.log('📋 Trying default credentials (Google Cloud)...');
      try {
        this.app = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        this.logger.log('✅ Firebase Admin initialized with default credentials');
        return;
      } catch (error) {
        this.logger.warn('⚠️ Default credentials not available:', error.message);
      }

      // Final warning
      this.logger.warn('⚠️ Firebase Admin not initialized: No credentials found');
      this.logger.warn('   To enable Firebase Admin SDK, set one of:');
      this.logger.warn('   - FIREBASE_SERVICE_ACCOUNT (JSON string)');
      this.logger.warn('   - FIREBASE_SERVICE_ACCOUNT_PATH (file path)');
      this.logger.warn('   See apps/backend/FIREBASE_ADMIN_SETUP.md for details');
    } catch (error) {
      this.logger.error('❌ Failed to initialize Firebase Admin:', error);
      if (error instanceof Error) {
        this.logger.error(`   Error message: ${error.message}`);
        this.logger.error(`   Stack: ${error.stack}`);
      }
    }
  }

  getApp(): admin.app.App | null {
    return this.app;
  }

  isInitialized(): boolean {
    return this.app !== null;
  }

  async sendMessage(
    token: string,
    notification: {
      title: string;
      body: string;
    },
    data?: Record<string, string>,
    options?: {
      channelId?: string;
      priority?: 'high' | 'normal';
    },
  ): Promise<string> {
    if (!this.app) {
      throw new Error('Firebase Admin not initialized');
    }

    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: data
        ? Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {} as Record<string, string>)
        : undefined,
      android: {
        priority: options?.priority || 'high',
        notification: {
          channelId: options?.channelId || 'default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().send(message);
      this.logger.log(`✅ FCM message sent: ${response}`);
      return response;
    } catch (error) {
      this.logger.error(`❌ Error sending FCM message:`, error);
      throw error;
    }
  }

  async sendMulticast(
    tokens: string[],
    notification: {
      title: string;
      body: string;
    },
    data?: Record<string, string>,
    options?: {
      channelId?: string;
      priority?: 'high' | 'normal';
      actions?: Array<{ action: string; title: string }>;
    },
  ): Promise<admin.messaging.BatchResponse> {
    if (!this.app) {
      throw new Error('Firebase Admin not initialized');
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: data
        ? Object.keys(data).reduce((acc, key) => {
            acc[key] = String(data[key]);
            return acc;
          }, {} as Record<string, string>)
        : undefined,
      android: {
        priority: options?.priority || 'high',
        notification: {
          channelId: options?.channelId || 'default',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            category: options?.actions && options.actions.length > 0 ? 'BOOKING_ACTIONS' : undefined,
          },
        },
      },
    };

    // Add action buttons to data payload for React Native handling
    if (options?.actions && options.actions.length > 0 && message.data) {
      message.data.actions = JSON.stringify(options.actions);
    }

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      this.logger.log(
        `✅ FCM multicast sent: ${response.successCount} successful, ${response.failureCount} failed`,
      );
      return response;
    } catch (error) {
      this.logger.error(`❌ Error sending FCM multicast:`, error);
      throw error;
    }
  }
}

