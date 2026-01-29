import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateClientNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  note: string;
}

