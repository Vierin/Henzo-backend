import {
  Controller,
  Post,
  Delete,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, true);
        } else {
          cb(
            new HttpException(
              'Only image files are allowed',
              HttpStatus.BAD_REQUEST,
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      // Upload to Supabase Storage using service role
      const filePath = await this.storageService.uploadFile(file);
      return {
        success: true,
        filePath,
        message: 'File uploaded successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to upload file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('delete')
  async deleteFile(@Body('filePath') filePath: string) {
    if (!filePath) {
      throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.storageService.deleteFile(filePath);
      return {
        success: true,
        message: 'File deleted successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to delete file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('get-public-url')
  async getPublicUrl(@Body('filePath') filePath: string) {
    if (!filePath) {
      throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const publicUrl = await this.storageService.getPublicUrl(filePath);
      return {
        success: true,
        publicUrl,
        message: 'Public URL generated successfully',
      };
    } catch (error) {
      throw new HttpException(
        'Failed to generate public URL',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
