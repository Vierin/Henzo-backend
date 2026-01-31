import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';

export enum TimeBlockType {
  TIME_OFF = 'TIME_OFF',
  BUSY = 'BUSY',
  CLOSURE = 'CLOSURE',
}

export enum ConflictAction {
  KEEP = 'KEEP',
  RESCHEDULE = 'RESCHEDULE',
  CANCEL = 'CANCEL',
}

export class CreateTimeBlockDto {
  @IsOptional()
  @IsString()
  staffId?: string;

  @IsEnum(TimeBlockType)
  @IsNotEmpty()
  type: TimeBlockType;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsEnum(ConflictAction)
  @IsNotEmpty()
  conflictAction: ConflictAction;

  @IsOptional()
  @IsString()
  rescheduleStaffId?: string;
}
