import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';
import { TimeBlockType, ConflictAction } from './create-time-block.dto';

export class UpdateTimeBlockDto {
  @IsOptional()
  @IsEnum(TimeBlockType)
  type?: TimeBlockType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(ConflictAction)
  conflictAction?: ConflictAction;

  @IsOptional()
  @IsString()
  rescheduleStaffId?: string;
}


