import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Headers,
  Query,
  Res,
  HttpException,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { SalonsService } from './salons.service';
import { UpdateSalonDto } from './dto/update-salon.dto';
import { CreateSalonDto } from './dto/create-salon.dto';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { generateSalonSlug } from '../utils/slug';

@Controller('salons')
export class SalonsController {
  constructor(
    private readonly salonsService: SalonsService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('with-services')
  @Header('Cache-Control', 'public, max-age=600') // P1: Кэш на 10 минут
  async getSalonsWithServices() {
    try {
      return await this.salonsService.findSalonsWithServices();
    } catch (error) {
      console.error('❌ Error getting salons with services:', error);
      throw new HttpException(
        error.message || 'Failed to get salons with services',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('search')
  @Header('Cache-Control', 'public, max-age=300') // P1: Кэш на 5 минут
  async searchSalons(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('location') location?: string,
    @Query('category') category?: string,
    @Query('sortBy') sortBy?: string,
    @Query('minRating') minRating?: string,
    @Query('isOpenNow') isOpenNow?: string,
    @Query('date') date?: string,
    @Query('time') time?: string,
  ) {
    const params = {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      location,
      category,
      sortBy,
      minRating: minRating ? parseInt(minRating, 10) : undefined,
      isOpenNow: isOpenNow === 'true',
      date,
      time,
    };

    const result = await this.salonsService.searchSalons(params);
    return {
      success: true,
      ...result,
    };
  }

  @Get('preview')
  async getSalonsPreview(
    @Query('limit') limit?: string,
    @Query('page') page?: string,
    @Query('location') location?: string,
    @Query('featured') featured?: string,
  ) {
    const params = {
      limit: limit ? parseInt(limit, 10) : 20,
      page: page ? parseInt(page, 10) : 1,
      location,
      featured: featured === 'true',
    };

    return this.salonsService.findSalonsPreview(params);
  }

  @Get('featured')
  @Header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours (featured salons rarely change)
  async getFeaturedSalons(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 6;
    return this.salonsService.findFeaturedSalons(limitNum);
  }

  @Get('nearby')
  async getNearbySalons(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('limit') limit?: string,
  ) {
    const params = {
      lat: lat ? parseFloat(lat) : undefined,
      lng: lng ? parseFloat(lng) : undefined,
      radius: radius ? parseInt(radius, 10) : 50, // km - default 50km for MVP
      limit: limit ? parseInt(limit, 10) : 10,
    };

    return this.salonsService.findNearbySalons(params);
  }

  @Get(':id/stats')
  async getSalonStats(@Param('id') id: string) {
    return this.salonsService.getSalonStats(id);
  }

  @Get(':id/availability')
  async getSalonAvailability(
    @Param('id') id: string,
    @Query('date') date?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    return this.salonsService.getSalonAvailability(id, date, serviceId);
  }

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=86400') // Cache for 24 hours - categories rarely change
  async getSalonCategories() {
    return this.salonsService.getSalonCategories();
  }

  @Get('current')
  async getCurrentUserSalon(@Headers('authorization') authHeader: string) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      const result = await this.salonsService.getCurrentUserSalon(
        currentUser.user.id,
      );

      if (!result) {
        return { success: false, message: 'No salon found for this user' };
      }

      return { success: true, data: result };
    } catch (error) {
      console.error('❌ Get current salon failed:', error.message);
      return { success: false, message: error.message };
    }
  }

  @Post('current')
  async createCurrentUserSalon(
    @Body() createSalonDto: CreateSalonDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 Received create salon request:', {
        hasAuthHeader: !!authHeader,
        dataKeys: Object.keys(createSalonDto),
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log('✅ User authenticated:', currentUser.user.email);

      const result = await this.salonsService.createCurrentUserSalon(
        createSalonDto,
        currentUser.user.id,
      );

      console.log('✅ Salon created successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Create salon failed:', error.message);
      throw error;
    }
  }

  @Put('current')
  async updateCurrentUserSalon(
    @Body() updateSalonDto: UpdateSalonDto,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      console.log('📝 Received update salon request:', {
        hasAuthHeader: !!authHeader,
        dataKeys: Object.keys(updateSalonDto),
      });

      const currentUser = await this.authService.getCurrentUser(authHeader);
      console.log('✅ User authenticated:', currentUser.user.email);

      const result = await this.salonsService.updateCurrentUserSalon(
        updateSalonDto,
        currentUser.user.id,
      );

      console.log('✅ Salon updated successfully:', result.id);
      return result;
    } catch (error) {
      console.error('❌ Update salon failed:', error.message);
      throw error;
    }
  }

  @Get('current/qr-pdf')
  async generateQRPDF(
    @Headers('authorization') authHeader: string,
    @Query('locale') locale: string = 'en',
    @Res() res: Response,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);

      // Get user's salon
      const salon = await this.prisma.salon.findFirst({
        where: { ownerId: currentUser.user.id },
        select: { id: true, slug: true, name: true, address: true, phone: true, email: true },
      });

      if (!salon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      // Use slug from DB or generate if not exists
      const baseUrl = process.env.FRONTEND_URL || 'https://henzo.app';
      const slug = salon.slug || generateSalonSlug(
        salon.name,
        salon.id,
        salon.address || undefined,
      );
      const salonUrl = `${baseUrl}/salon/${slug}`;

      // Generate QR code URL (increased size to match PDF display)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(salonUrl)}`;

      // PDF translations based on locale
      const pdfTranslations: Record<string, { title1: string; title2: string; description: string; footer1: string; footer2: string }> = {
        en: {
          title1: 'BOOK YOUR',
          title2: 'APPOINTMENT',
          description: 'Quick & easy in just a few steps!',
          footer1: 'Scan QR code',
          footer2: 'to book now!',
        },
        ru: {
          title1: 'ЗАПИШИТЕСЬ',
          title2: 'НА ПРИЕМ',
          description: 'Быстро и легко всего за несколько шагов!',
          footer1: 'Отсканируйте QR-код',
          footer2: 'чтобы записаться прямо сейчас!',
        },
        vi: {
          title1: 'ĐẶT LỊCH',
          title2: 'HẸN CỦA BẠN',
          description: 'Nhanh chóng & dễ dàng chỉ với vài thao tác!',
          footer1: 'Quét mã QR',
          footer2: 'để đặt lịch ngay!',
        },
      };

      // Get translations for the requested locale (default to 'en')
      const validLocale = locale && ['en', 'ru', 'vi'].includes(locale) ? locale : 'en';
      const translations = pdfTranslations[validLocale] || pdfTranslations['en'];

      // Dynamic import for Puppeteer to avoid issues
      const puppeteer = await import('puppeteer');

      // Launch Puppeteer
      // Use system Chromium if available (in Docker), otherwise use bundled browser
      const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: executablePath || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });

      const page = await browser.newPage();

      // Create HTML content for the PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page {
              margin: 0;
            }
            
            body {
              margin: 0;
              padding: 0;
              font-family: 'Quicksand', 'Helvetica', Arial, sans-serif;
              background-color: #F4EFEC;
              height: 90svh;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              padding: 40px;
            }
            
            .top-section {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: flex-start;
              align-items: center;
              margin-top: 60px;
            }
            
            .business-name {
              font-size: 20px;
              color: #413E3B;
              margin-bottom: 25px;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: 500;
            }
            
            .title-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-bottom: 50px;
            }
            
            .title-line {
              font-size: 64px;
              color: #413E3B;
              font-weight: 400;
              text-align: center;
              margin: 0;
              line-height: 1.2;
            }

            .title-description {
              font-size: 26px;
              color: #413E3B;
              font-weight: 400;
              text-align: center;
              margin: 0;
              margin-top: 20px;
              line-height: 1.2;
            }
            
            .qr-section {
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 40px;
              padding: 20px;
              border-radius: 15px;
              background-color: #fff;
            }
            
            .qr-code {
              width: 300px;
              height: 300px;
            }
            
            .contact-section {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-bottom: 60px;
            }
            
            .contact-item {
              display: flex;
              align-items: center;
              margin-bottom: 15px;
              justify-content: center;
            }
            
            .contact-icon {
              width: 30px;
              height: 30px;
              margin-right: 12px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .contact-text {
              font-size: 24px;
              color:#413E3B;
              font-weight: normal;
            }
            
            .bottom-section {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            
            .footer-text {
              font-size: 28px;
              color:#413E3B;
              line-height: 1.25;
              text-align: center;
              font-weight: 400;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="top-section">
            
            <div class="title-section">
              <h1 class="title-line">${translations.title1}</h1>
              <h1 class="title-line">${translations.title2}</h1>
              <p class="title-description">${translations.description}</p>
            </div>
            
            <div class="qr-section">
              <img src="${qrCodeUrl}" alt="QR Code" class="qr-code" />
            </div>

            <div class="business-name">${salon.name?.toUpperCase() || ''}</div>
            
            <div class="contact-section">
              ${
                salon.phone
                  ? `
                <div class="contact-item">
                  <div class="contact-icon phone"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone-icon lucide-phone"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg></div>
                  <div class="contact-text">${salon.phone}</div>
                </div>
              `
                  : ''
              }
              
              ${
                salon.email
                  ? `
                <div class="contact-item">
                  <div class="contact-icon email"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone-icon lucide-phone"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg></div>
                  <div class="contact-text">${salon.email}</div>
                </div>
              `
                  : ''
              }
            </div>
          </div>
          
          <div class="bottom-section">
            <p class="footer-text">${translations.footer1}</p>
            <p class="footer-text">${translations.footer2}</p>
          </div>
        </body>
        </html>
      `;

      // Set the HTML content with longer timeout for images
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Wait for images to load
      await page.waitForSelector('img', { timeout: 10000 }).catch(() => {
        console.log('No images found or timeout waiting for images');
      });

      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready');

      console.log('HTML content set, generating PDF...');
      console.log('QR Code URL:', qrCodeUrl);

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0',
          right: '0',
          bottom: '0',
          left: '0',
        },
        timeout: 30000, // 30 second timeout
      });

      console.log('PDF buffer size:', pdfBuffer.length);

      await browser.close();

      // Set headers for PDF viewing (inline instead of attachment)
      // Use res.end() instead of res.send() to avoid charset issues
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="salon-qr-code.pdf"',
      );
      res.setHeader('Content-Length', pdfBuffer.length.toString());
      res.end(pdfBuffer);
    } catch (error) {
      console.error('Error generating PDF:', error);
      const message = error?.message?.includes('Executable doesn\'t exist') || error?.message?.includes('Could not find Chromium')
        ? 'PDF export is not available on this server (Chromium not installed).'
        : 'Failed to generate PDF';
      throw new HttpException(message, HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @Get('by-slug/:slug')
  @Header('Cache-Control', 'public, max-age=600') // Cache for 10 minutes
  async getSalonBySlug(@Param('slug') slug: string) {
    try {
      const result = await this.salonsService.findBySlug(slug);
      if (!result) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }
      return result;
    } catch (error) {
      console.error('❌ Error getting salon by slug:', error);
      throw error;
    }
  }

  @Get(':id')
  @Header('Cache-Control', 'public, max-age=600') // P1: Кэш на 10 минут
  async getSalonById(@Param('id') id: string) {
    try {
      const result = await this.salonsService.findById(id);
      if (!result) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }
      return result;
    } catch (error) {
      console.error('❌ Error getting salon by id:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to get salon',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id/publish')
  async publishSalon(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
  ) {
    try {
      const currentUser = await this.authService.getCurrentUser(authHeader);
      
      // Verify salon belongs to user
      const salon = await this.prisma.salon.findFirst({
        where: { id, ownerId: currentUser.user.id },
        select: { id: true, status: true },
      });

      if (!salon) {
        throw new HttpException('Salon not found', HttpStatus.NOT_FOUND);
      }

      // Update salon status to ACTIVE
      const updatedSalon = await this.prisma.salon.update({
        where: { id },
        data: { status: 'ACTIVE' },
      });

      return updatedSalon;
    } catch (error) {
      console.error('❌ Error publishing salon:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Failed to publish salon',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
