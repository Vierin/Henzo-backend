import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';

export class RegisterClientDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
