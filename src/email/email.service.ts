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

  private formatVND(amount: number): string {
    if (amount >= 1_000_000) {
      const millions = amount / 1_000_000;
      return `${millions % 1 === 0 ? millions : millions.toFixed(1)}M ₫`;
    }
    if (amount >= 1_000) {
      const thousands = amount / 1_000;
      return `${thousands % 1 === 0 ? thousands : thousands.toFixed(1)}K ₫`;
    }
    return `${amount} ₫`;
  }

  private async sendEmailViaBrevo(emailData: {
    to: { email: string; name: string }[];
    sender: { email: string; name: string };
    subject: string;
    htmlContent: string;
  }) {
    try {
      if (!this.brevoApiKey) {
        console.error(
          '❌ BREVO_API_KEY is not configured. Email cannot be sent.',
        );
        throw new Error('BREVO_API_KEY is not configured');
      }

      // Validate email addresses
      const recipientEmails = emailData.to.map((recipient) => recipient.email);
      console.log('📧 Attempting to send email via Brevo:', {
        to: recipientEmails,
        subject: emailData.subject,
        hasApiKey: !!this.brevoApiKey,
      });

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
        let errorMessage = `Brevo API error: ${response.status} - ${errorData}`;

        // Handle specific Brevo errors
        if (response.status === 401) {
          try {
            const errorJson = JSON.parse(errorData);
            if (
              errorJson.code === 'unauthorized' &&
              errorJson.message?.includes('IP address')
            ) {
              errorMessage = `Brevo IP authorization required: ${errorJson.message}. Please add your IP address at https://app.brevo.com/security/authorised_ips`;
              console.error('❌ Brevo IP authorization error:', errorMessage);
            }
          } catch (e) {
            // If parsing fails, use original error
          }
        }

        console.error('❌ Brevo API error response:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Email sent via Brevo successfully:', {
        messageId: result.messageId,
        to: recipientEmails,
      });
      return result;
    } catch (error) {
      console.error('❌ Brevo API error:', {
        error: error instanceof Error ? error.message : error,
        to: emailData.to.map((r) => r.email),
      });
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
                  <span class="detail-value">${this.formatVND(bookingData.price)}</span>
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
            'noreply@henzo.app',
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
                  <span class="detail-value">${this.formatVND(bookingData.price)}</span>
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
            'noreply@henzo.app',
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
                  <span class="detail-value">${this.formatVND(bookingData.price)}</span>
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
            'noreply@henzo.app',
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

  async sendContactMessage(data: {
    to: string;
    subject: string;
    template: string;
    context: {
      name: string;
      email: string;
      message: string;
      timestamp: string;
    };
  }) {
    try {
      console.log('📧 Sending contact message to:', data.to);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Contact Form Message - Henzo</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff6b35; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .message-content { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #ff6b35; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 New Contact Form Message</h1>
              <p>Someone has sent a message through the Henzo contact form</p>
            </div>
            
            <div class="content">
              <div class="message-details">
                <h3>👤 Contact Information</h3>
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${data.context.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${data.context.email}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Timestamp:</span>
                  <span class="detail-value">${data.context.timestamp}</span>
                </div>
              </div>

              <div class="message-details">
                <h3>💬 Message</h3>
                <div class="message-content">
                  ${data.context.message.replace(/\n/g, '<br>')}
                </div>
              </div>
            </div>
            
            <div class="footer">
              <p>This message was sent through the Henzo contact form.</p>
              <p>Reply directly to the sender's email address to respond.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: [{ email: data.to, name: 'Henzo Team' }],
        sender: {
          email:
            this.configService.get<string>('BREVO_FROM_EMAIL') ||
            'noreply@henzo.app',
          name: 'Henzo Contact Form',
        },
        subject: data.subject,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Contact message sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending contact message:', error);
      throw error;
    }
  }

  async sendSalonBookingRequest(
    salonEmail: string,
    salonName: string,
    bookingData: {
      bookingId: string;
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
      console.log('📧 Sending salon booking request to:', salonEmail);

      const baseUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:3000';
      const confirmUrl = `${baseUrl}/bookings/${bookingData.bookingId}/confirm`;
      const rejectUrl = `${baseUrl}/bookings/${bookingData.bookingId}/reject`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>New Booking Request - ${salonName}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .urgent { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center; }
            .button-container { text-align: center; margin: 30px 0; }
            .button { display: inline-block; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 0 10px; font-weight: bold; font-size: 16px; }
            .button-confirm { background-color: #28a745; color: white; }
            .button-reject { background-color: #dc3545; color: white; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔔 New Booking Request!</h1>
              <p>Action Required - Booking Awaiting Confirmation</p>
            </div>
            
            <div class="content">
              <div class="urgent">
                <h3>⏰ Please confirm or reject this booking</h3>
                <p>A client is waiting for your response</p>
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
                  <span class="detail-value">${this.formatVND(bookingData.price)}</span>
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

              <div class="button-container">
                <a href="${confirmUrl}" class="button button-confirm">✅ Confirm Booking</a>
                <a href="${rejectUrl}" class="button button-reject">❌ Reject Booking</a>
              </div>

              <p style="text-align: center; margin-top: 20px; color: #666;">
                Click on the buttons above to confirm or reject this booking request.
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated notification from your booking system.</p>
              <p>Please respond as soon as possible to provide the best service to your clients.</p>
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
            'noreply@henzo.app',
          name: 'Henzo Booking System',
        },
        subject: `🔔 New Booking Request - ${bookingData.clientName} at ${bookingData.time}`,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Salon booking request sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending salon booking request:', error);
      throw error;
    }
  }

  async sendBookingPending(
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
      console.log('📧 Sending pending booking notification to:', clientEmail);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Booking Request Received - ${bookingData.salonName}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .pending-notice { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; margin: 20px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏳ Booking Request Received!</h1>
              <p>We've received your booking request</p>
            </div>
            
            <div class="content">
              <h2>Hello ${clientName}!</h2>
              
              <div class="pending-notice">
                <h3>⏰ Awaiting Salon Confirmation</h3>
                <p>Your booking request has been sent to <strong>${bookingData.salonName}</strong>.</p>
                <p>Usually the salon confirms the booking within 2 hours. We'll notify you as soon as the salon confirms your appointment.</p>
              </div>
              
              <div class="booking-details">
                <h3>📅 Requested Appointment Details</h3>
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
                  <span class="detail-value">${this.formatVND(bookingData.price)}</span>
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

              <p><strong>What's Next?</strong></p>
              <ul>
                <li>The salon will review your request</li>
                <li>You'll receive a confirmation email once approved</li>
                <li>If there are any issues, the salon will contact you directly</li>
              </ul>
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
            'noreply@henzo.app',
          name: 'Henzo Booking System',
        },
        subject: `Booking Request Received - ${bookingData.salonName}`,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log(
        '✅ Booking pending notification sent successfully via Brevo',
      );
      return result;
    } catch (error) {
      console.error('❌ Error sending booking pending notification:', error);
      throw error;
    }
  }

  async sendBookingRejection(
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
      reason?: string;
    },
  ) {
    try {
      console.log('📧 Sending booking rejection to:', clientEmail);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Booking Request Update - ${bookingData.salonName}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
            .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .rejection-notice { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .button { display: inline-block; background-color: #ff5b5b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Request Update</h1>
              <p>Update regarding your appointment request</p>
            </div>
            
            <div class="content">
              <h2>Hello ${clientName},</h2>
              
              <div class="rejection-notice">
                <h3>❌ Booking Request Not Confirmed</h3>
                <p>Unfortunately, ${bookingData.salonName} was unable to confirm your booking request.</p>
                ${bookingData.reason ? `<p><strong>Reason:</strong> ${bookingData.reason}</p>` : ''}
              </div>
              
              <div class="booking-details">
                <h3>📅 Requested Appointment Details</h3>
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
              </div>

              <div class="booking-details">
                <h3>🏢 Salon Contact</h3>
                <div class="detail-row">
                  <span class="detail-label">Salon:</span>
                  <span class="detail-value">${bookingData.salonName}</span>
                </div>
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

              <p><strong>What Can You Do?</strong></p>
              <ul>
                <li>Try booking a different time slot</li>
                <li>Contact the salon directly for more information</li>
                <li>Explore other available services</li>
              </ul>

              <p>We apologize for any inconvenience. Please feel free to make another booking request or contact the salon directly.</p>
            </div>
            
            <div class="footer">
              <p>Thank you for using Henzo Booking System</p>
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
            'noreply@henzo.app',
          name: 'Henzo Booking System',
        },
        subject: `Booking Request Update - ${bookingData.salonName}`,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Booking rejection sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending booking rejection:', error);
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

  async sendInviteCode(
    ownerEmail: string,
    inviteData: {
      code: string;
      registrationLink: string;
    },
  ) {
    // Add email to registration link
    const linkWithEmail = `${inviteData.registrationLink}&email=${encodeURIComponent(ownerEmail)}`;
    inviteData.registrationLink = linkWithEmail;
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f4f4f4;
                margin: 0;
                padding: 0;
              }
              .container {
                max-width: 600px;
                margin: 20px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
              }
              .header {
                background: linear-gradient(135deg, #ff5b5b 0%, #ff7979 100%);
                color: white;
                padding: 30px;
                text-align: center;
              }
              .header h1 {
                margin: 0;
                font-size: 28px;
                font-weight: 600;
              }
              .content {
                padding: 40px 30px;
              }
              .welcome-text {
                font-size: 18px;
                color: #2c3e50;
                margin-bottom: 20px;
              }
              .invite-box {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-left: 4px solid #ff5b5b;
                padding: 25px;
                margin: 25px 0;
                border-radius: 8px;
              }
              .invite-code {
                font-size: 32px;
                font-weight: bold;
                color: #ff5b5b;
                letter-spacing: 3px;
                text-align: center;
                margin: 15px 0;
                font-family: 'Courier New', monospace;
              }
              .button {
                display: inline-block;
                padding: 15px 40px;
                background: linear-gradient(135deg, #ff5b5b 0%, #ff7979 100%);
                color: white !important;
                text-decoration: none;
                border-radius: 25px;
                font-weight: 600;
                text-align: center;
                margin: 20px 0;
                transition: transform 0.2s;
              }
              .button:hover {
                transform: translateY(-2px);
              }
              .button-container {
                text-align: center;
              }
              .info-text {
                background-color: #fff3cd;
                border: 1px solid #ffc107;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                color: #856404;
              }
              .features {
                margin: 30px 0;
              }
              .feature-item {
                display: flex;
                align-items: start;
                margin: 15px 0;
              }
              .feature-icon {
                color: #ff5b5b;
                margin-right: 10px;
                font-size: 20px;
              }
              .footer {
                background-color: #f8f9fa;
                padding: 25px;
                text-align: center;
                color: #6c757d;
                font-size: 14px;
                border-top: 1px solid #dee2e6;
              }
              .footer a {
                color: #ff5b5b;
                text-decoration: none;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Welcome to Henzo!</h1>
              </div>

              <div class="content">
                <p class="welcome-text">Hello,</p>
                
                <p>We're excited to invite you to join <strong>Henzo</strong> - the leading beauty salon management platform!</p>

                <div class="invite-box">
                  <p style="text-align: center; margin: 0; color: #6c757d; font-size: 14px;">Your Invitation Code</p>
                  <div class="invite-code">${inviteData.code}</div>
                  <p style="text-align: center; margin: 0; color: #6c757d; font-size: 12px;">This code is valid for one-time use only</p>
                </div>

                <div class="button-container">
                  <a href="${inviteData.registrationLink}" class="button">
                    Complete Registration →
                  </a>
                </div>

                <div class="info-text">
                  <strong>⏰ Next Steps:</strong><br>
                  1. Click the button above to start registration<br>
                  2. Complete your salon profile<br>
                  3. Start accepting bookings!
                </div>

                <div class="features">
                  <h3 style="color: #2c3e50;">What You'll Get:</h3>
                  <div class="feature-item">
                    <span class="feature-icon">✓</span>
                    <span><strong>Online Booking System:</strong> Let clients book appointments 24/7</span>
                  </div>
                  <div class="feature-item">
                    <span class="feature-icon">✓</span>
                    <span><strong>Customer Management:</strong> Track client history and preferences</span>
                  </div>
                  <div class="feature-item">
                    <span class="feature-icon">✓</span>
                    <span><strong>Automated Notifications:</strong> Email reminders for clients</span>
                  </div>
                  <div class="feature-item">
                    <span class="feature-icon">✓</span>
                    <span><strong>Analytics Dashboard:</strong> Track your salon's performance</span>
                  </div>
                  <div class="feature-item">
                    <span class="feature-icon">✓</span>
                    <span><strong>Service Management:</strong> Easy setup for services and pricing</span>
                  </div>
                </div>

                <p style="color: #6c757d; font-size: 14px; margin-top: 30px;">
                  If you have any questions, feel free to contact our support team.
                </p>
              </div>

              <div class="footer">
                <p>
                  This invitation was sent to <strong>${ownerEmail}</strong><br>
                  If you didn't request this invitation, please ignore this email.
                </p>
                <p style="margin-top: 15px;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}">Visit Henzo</a> | 
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/contact">Contact Support</a>
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      await this.sendEmailViaBrevo({
        to: [{ email: ownerEmail, name: 'Salon Owner' }],
        sender: {
          email: 'noreply@henzo.app',
          name: 'Henzo Team',
        },
        subject: `🎉 Your Invitation to Join Henzo - Code: ${inviteData.code}`,
        htmlContent,
      });

      console.log(`✅ Invite code email sent to ${ownerEmail}`);
    } catch (error) {
      console.error('❌ Error sending invite code email:', error);
      throw error;
    }
  }

  async sendMagicLinkConfirmation(
    clientEmail: string,
    data: {
      confirmUrl: string;
      serviceName: string;
      salonName: string;
      date: string;
      time: string;
    },
  ) {
    try {
      console.log('📧 Sending magic link confirmation to:', clientEmail);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Confirm Your Booking - ${data.salonName}</title>
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
            .button { display: inline-block; background-color: #ff5b5b; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
            .button-container { text-align: center; margin: 30px 0; }
            .notice { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📧 Confirm Your Booking</h1>
              <p>Click the link below to complete your reservation</p>
            </div>
            
            <div class="content">
              <h2>Hello!</h2>
              <p>You've requested to book an appointment at <strong>${data.salonName}</strong>. Please confirm your booking by clicking the button below:</p>
              
              <div class="button-container">
                <a href="${data.confirmUrl}" class="button">Confirm Booking</a>
              </div>

              <div class="booking-details">
                <h3>📅 Booking Details</h3>
                <div class="detail-row">
                  <span class="detail-label">Service:</span>
                  <span class="detail-value">${data.serviceName}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Date:</span>
                  <span class="detail-value">${data.date}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Time:</span>
                  <span class="detail-value">${data.time}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Salon:</span>
                  <span class="detail-value">${data.salonName}</span>
                </div>
              </div>

              <div class="notice">
                <p><strong>⏰ Important:</strong> This confirmation link will expire in 1 hour.</p>
                <p>If you didn't request this booking, please ignore this email.</p>
              </div>

              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${data.confirmUrl}</p>
            </div>
            
            <div class="footer">
              <p>Thank you for choosing ${data.salonName}!</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const emailData = {
        to: [{ email: clientEmail, name: 'Guest' }],
        sender: {
          email:
            this.configService.get<string>('BREVO_FROM_EMAIL') ||
            'noreply@henzo.app',
          name: 'Henzo Booking System',
        },
        subject: `Confirm Your Booking - ${data.salonName}`,
        htmlContent: htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Magic link confirmation sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending magic link confirmation:', error);
      throw error;
    }
  }

  async sendBusinessRegistrationMagicLink(
    email: string,
    name: string,
    registerUrl: string,
  ) {
    try {
      console.log('📧 Sending business registration magic link to:', email);

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Complete Your Business Registration - Henzo</title>
          <!--[if mso]>
          <style type="text/css">
            body, table, td { font-family: Arial, sans-serif !important; }
          </style>
          <![endif]-->
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
            <tr>
              <td style="padding: 20px 0;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; max-width: 600px; width: 100%;">
                  <!-- Header -->
                  <tr>
                    <td style="background-color: #ff5b5b; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold; line-height: 1.4;">🚀 Complete Your Business Registration</h1>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
                      <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
                      <p style="margin: 0 0 24px 0; color: #333333; font-size: 16px; line-height: 1.6;">Thank you for your interest in Henzo! Click the button below to complete your business account registration:</p>
                      
                      <!-- Button -->
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
                        <tr>
                          <td style="text-align: center;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="background-color: #ff5b5b; border-radius: 5px; text-align: center;">
                                  <a href="${registerUrl}" style="display: inline-block; padding: 15px 30px; color: #ffffff !important; text-decoration: none; font-size: 16px; font-weight: bold; border-radius: 5px; background-color: #ff5b5b; white-space: nowrap;">Complete Registration</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="margin: 24px 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;">Or copy and paste this link into your browser:</p>
                      <p style="margin: 0 0 24px 0; word-break: break-all; color: #666666; font-size: 14px; line-height: 1.6; background-color: #ffffff; padding: 12px; border-radius: 4px; border: 1px solid #e0e0e0;">${registerUrl}</p>
                      <p style="margin: 0 0 16px 0; color: #333333; font-size: 16px; line-height: 1.6;"><strong>This link will expire in 24 hours.</strong></p>
                      <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">If you didn't request this registration, please ignore this email.</p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 20px 20px 20px; text-align: center;">
                      <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6;">This is an automated message from Henzo. Please do not reply to this email.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const emailData = {
        to: [{ email, name }],
        sender: {
          email:
            this.configService.get<string>('BREVO_FROM_EMAIL') ||
            'noreply@henzo.app',
          name: 'Henzo Business Platform',
        },
        subject: 'Complete Your Business Registration - Henzo',
        htmlContent,
      };

      const result = await this.sendEmailViaBrevo(emailData);
      console.log('✅ Business registration magic link sent successfully via Brevo');
      return result;
    } catch (error) {
      console.error('❌ Error sending business registration magic link:', error);
      throw error;
    }
  }
}
