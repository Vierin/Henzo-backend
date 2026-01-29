import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateClientNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  note: string;
}

