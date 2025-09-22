import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private supabase;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      // Generate unique filename
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `salon-uploads/${fileName}`;

      // Upload to Supabase Storage using service role (bypasses RLS)
      const { error } = await this.supabase.storage
        .from('salon-files')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      return filePath;
    } catch (error) {
      console.error('Storage service upload error:', error);
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage
        .from('salon-files')
        .remove([filePath]);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    } catch (error) {
      console.error('Storage service delete error:', error);
      throw error;
    }
  }

  async getPublicUrl(filePath: string): Promise<string> {
    try {
      const { data } = this.supabase.storage
        .from('salon-files')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Storage service getPublicUrl error:', error);
      throw error;
    }
  }
}
