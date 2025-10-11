import { Injectable } from '@nestjs/common';
import { ContactDto } from './dto/contact.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class ContactService {
  constructor(private readonly emailService: EmailService) {}

  async sendMessage(contactDto: ContactDto) {
    const { name, email, message } = contactDto;

    // Отправляем email на contact@henzo.app
    await this.emailService.sendContactMessage({
      to: 'contact@henzo.app',
      subject: `New Beta Request from ${name}`,
      template: 'contact-message',
      context: {
        name,
        email,
        message,
        timestamp: new Date().toLocaleString(),
      },
    });

    return {
      success: true,
      message:
        'Your message has been sent successfully. We will get back to you soon!',
    };
  }
}
