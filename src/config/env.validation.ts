import { plainToClass } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsIn,
  validateSync,
} from 'class-validator';

export class EnvironmentVariables {
  // Database
  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  DIRECT_URL: string;

  // Supabase
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL: string;

  // SUPABASE_KEY / SUPABASE_ANON_KEY - optional
  // Can use either SUPABASE_KEY or SUPABASE_ANON_KEY
  @IsString()
  @IsOptional()
  SUPABASE_KEY?: string;

  @IsString()
  @IsOptional()
  SUPABASE_ANON_KEY?: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_ROLE_KEY: string;

  // JWT
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  // Email (Brevo)
  @IsString()
  @IsNotEmpty()
  BREVO_API_KEY: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM?: string;

  @IsString()
  @IsOptional()
  EMAIL_FROM_NAME?: string;

  // Application
  @IsNumberString()
  @IsOptional()
  PORT?: string;

  @IsString()
  @IsIn(['development', 'production', 'test'])
  @IsOptional()
  NODE_ENV?: string;

  // Frontend
  @IsString()
  @IsOptional()
  FRONTEND_URL?: string;

  // Mapbox (optional)
  @IsString()
  @IsOptional()
  MAPBOX_ACCESS_TOKEN?: string;

  // Sentry (optional)
  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;

  // Sentry dev mode (optional)
  @IsString()
  @IsOptional()
  ENABLE_SENTRY_IN_DEV?: string;

  // Stripe (optional; required for subscription checkout)
  @IsString()
  @IsOptional()
  STRIPE_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  STRIPE_MONTHLY_PRICE_ID?: string;

  @IsString()
  @IsOptional()
  STRIPE_ANNUAL_PRICE_ID?: string;

  @IsString()
  @IsOptional()
  STRIPE_YEARLY_PRICE_ID?: string;

  @IsString()
  @IsOptional()
  STRIPE_WEBHOOK_SECRET?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const missingVars = errors.map((error) => {
      const constraints = Object.values(error.constraints || {});
      return `  - ${error.property}: ${constraints.join(', ')}`;
    });

    throw new Error(
      `❌ Environment validation failed:\n${missingVars.join('\n')}\n\nPlease check your .env file.`,
    );
  }

  return validatedConfig;
}
