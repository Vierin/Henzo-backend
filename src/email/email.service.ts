import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private brevoApiKey: string;
  private brevoApiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor(private configService: ConfigService) {
    // Initialize Brevo
    this.brevoApiKey = this.configService.get<string>('BREVO_API_KEY') || '';
    if (this.brevoApiKey) {
      console.log('✅ Brevo initialized');
    } else {
      console.warn('⚠️ BREVO_API_KEY not found in environment variables');
    }
  }

  private async sendEmailViaBrevo(emailData: {
    to: { email: string; name: string }[];
    sender: { email: string; name: string };
    subject: string;
    htmlContent: string;
  }) {
    try {
      const response = await fetch(this.brevoApiUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': this.brevoApiKey,
        },
        body: JSON.stringify(emailData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Brevo API error: ${response.status} - ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Email sent via Brevo:', result.messageId);
      return result;
    } catch (error) {
      console.error('❌ Brevo API error:', error);
      throw error;
    }
  }

  async sendBookingConfirmation(
    clientEmail: string,
    clientName: string,
    bookingData: {
      serviceName: string;
      date: string;
      time: string;
      duration: number;
      price: number;
      salonName: string;
      salonAddress?: string;
      salonPhone?: string;
      staffName?: string;
    },
  ) {
    try {
      console.log('📧 Sending booking confirmation to:', clientEmail);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Booking Confirmation - ${bookingData.salonName}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff5b5b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .button { display: inline-block; background-color: #ff5b5b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Booking Confirmed!</h1>
              <p>Your appointment at ${bookingData.salonName} has been confirmed</p>
            </div>
            
            <div class="content">
              <h2>Hello ${clientName}!</h2>
              <p>Thank you for booking with us. Here are your appointment details:</p>
              
              <div class="booking-details">
                <h3>📅 Appointment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Service:</span>
                  <span class="detail-value">${bookingData.serviceName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${bookingData.date}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${bookingData.time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">${bookingData.duration} minutes</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Price:</span>
                  <span class="detail-value">$${bookingData.price}</span>
                </div>
                ${
                  bookingData.staffName
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Staff:</span>
                  <span class="detail-value">${bookingData.staffName}</span>
                </div>
                `
                    : ''
                }
              </div>

              <div class="booking-details">
                <h3>🏢 Salon Information</h3>
                <div class="detail-row">
                  <span class="detail-label">Salon:</span>
                  <span class="detail-value">${bookingData.salonName}</span>
                </div>
                ${
                  bookingData.salonAddress
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Address:</span>
                  <span class="detail-value">${bookingData.salonAddress}</span>
                </div>
                `
                    : ''
                }
                ${
                  bookingData.salonPhone
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${bookingData.salonPhone}</span>
                </div>
                `
                    : ''
                }
              </div>

              <p><strong>Important:</strong> Please arrive 5-10 minutes before your appointment time.</p>
              <p>If you need to reschedule or cancel, please contact the salon directly.</p>
            </div>
            
            <div class="footer">
              <p>Thank you for choosing ${bookingData.salonName}!</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: [{ email: clientEmail, name: clientName }],
        sender: {
          email:
            this.configService.get<string>('BREVO_FROM_EMAIL') ||
            'noreply@henzo.com',
          name: 'Henzo Booking System',
        },
        subject: `Booking Confirmation - ${bookingData.salonName}`,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Booking confirmation sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending booking confirmation:', error);
      throw error;
    }
  }

  async sendSalonNotification(
    salonEmail: string,
    salonName: string,
    bookingData: {
      serviceName: string;
      date: string;
      time: string;
      duration: number;
      price: number;
      clientName: string;
      clientEmail: string;
      clientPhone?: string;
      staffName?: string;
    },
  ) {
    try {
      console.log('📧 Sending salon notification to:', salonEmail);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Booking - ${salonName}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .urgent { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Booking Received!</h1>
              <p>A new appointment has been booked at ${salonName}</p>
            </div>
            
            <div class="content">
              <div class="urgent">
                <h3>📋 New Appointment Details</h3>
              </div>
              
              <div class="booking-details">
                <h3>👤 Client Information</h3>
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${bookingData.clientName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${bookingData.clientEmail}</span>
                </div>
                ${
                  bookingData.clientPhone
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${bookingData.clientPhone}</span>
                </div>
                `
                    : ''
                }
              </div>

              <div class="booking-details">
                <h3>📅 Appointment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Service:</span>
                  <span class="detail-value">${bookingData.serviceName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${bookingData.date}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${bookingData.time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">${bookingData.duration} minutes</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Price:</span>
                  <span class="detail-value">$${bookingData.price}</span>
                </div>
                ${
                  bookingData.staffName
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Assigned Staff:</span>
                  <span class="detail-value">${bookingData.staffName}</span>
                </div>
                `
                    : ''
                }
              </div>

              <p><strong>Next Steps:</strong></p>
              <ul>
                <li>Confirm the appointment with the client if needed</li>
                <li>Prepare the necessary equipment and supplies</li>
                <li>Ensure the assigned staff member is available</li>
              </ul>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from your booking system.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: [{ email: salonEmail, name: salonName }],
        sender: {
          email:
            this.configService.get<string>('BREVO_FROM_EMAIL') ||
            'noreply@henzo.com',
          name: 'Henzo Booking System',
        },
        subject: `New Booking - ${bookingData.clientName} at ${bookingData.time}`,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Salon notification sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending salon notification:', error);
      throw error;
    }
  }

  async sendBookingReminder(
    clientEmail: string,
    clientName: string,
    bookingData: {
      serviceName: string;
      date: string;
      time: string;
      duration: number;
      price: number;
      salonName: string;
      salonAddress?: string;
      salonPhone?: string;
      staffName?: string;
    },
  ) {
    try {
      console.log('📧 Sending booking reminder to:', clientEmail);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Appointment Reminder - ${bookingData.salonName}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff5b5b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .reminder { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; background-color: #ff5b5b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Appointment Reminder</h1>
              <p>Your appointment at ${bookingData.salonName} is tomorrow!</p>
            </div>
            
            <div class="content">
              <h2>Hello ${clientName}!</h2>
              
              <div class="reminder">
                <h3>🔔 Don't forget!</h3>
                <p>Your appointment is scheduled for <strong>tomorrow</strong>. We're looking forward to seeing you!</p>
              </div>
              
              <div class="booking-details">
                <h3>📅 Appointment Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Service:</span>
                  <span class="detail-value">${bookingData.serviceName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${bookingData.date}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${bookingData.time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Duration:</span>
                  <span class="detail-value">${bookingData.duration} minutes</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Price:</span>
                  <span class="detail-value">$${bookingData.price}</span>
                </div>
                ${
                  bookingData.staffName
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Staff:</span>
                  <span class="detail-value">${bookingData.staffName}</span>
                </div>
                `
                    : ''
                }
              </div>

              <div class="booking-details">
                <h3>🏢 Salon Information</h3>
                <div class="detail-row">
                  <span class="detail-label">Salon:</span>
                  <span class="detail-value">${bookingData.salonName}</span>
                </div>
                ${
                  bookingData.salonAddress
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Address:</span>
                  <span class="detail-value">${bookingData.salonAddress}</span>
                </div>
                `
                    : ''
                }
                ${
                  bookingData.salonPhone
                    ? `
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${bookingData.salonPhone}</span>
                </div>
                `
                    : ''
                }
              </div>

              <p><strong>Important:</strong> Please arrive 5-10 minutes before your appointment time.</p>
              <p>If you need to reschedule or cancel, please contact the salon directly as soon as possible.</p>
            </div>
            
            <div class="footer">
              <p>Thank you for choosing ${bookingData.salonName}!</p>
              <p>This is an automated reminder. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: [{ email: clientEmail, name: clientName }],
        sender: {
          email:
            this.configService.get<string>('BREVO_FROM_EMAIL') ||
            'noreply@henzo.com',
          name: 'Henzo Booking System',
        },
        subject: `Appointment Reminder - Tomorrow at ${bookingData.salonName}`,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Booking reminder sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending booking reminder:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!this.brevoApiKey) {
        console.error('❌ Brevo API key not configured');
        return false;
      }

      // Test with a simple API call
      const response = await fetch('https://api.brevo.com/v3/account', {
        headers: {
          Accept: 'application/json',
          'api-key': this.brevoApiKey,
        },
      });

      if (response.ok) {
        console.log('✅ Brevo API connection verified');
        return true;
      } else {
        console.error('❌ Brevo API connection failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Brevo API connection test failed:', error);
      return false;
    }
  }
}
