import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateApiKeyDto {
  @IsString() name!: string;
}

export class IngestLogDto {
  @IsOptional() @IsString() serviceId?: string;
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  @IsOptional() @IsString() environment?: string;
  @IsString() message!: string;
  @IsOptional() @IsString() stackTrace?: string;
  @IsOptional() @IsString() traceId?: string;
  @IsOptional() timestamp?: string;
  @IsOptional() metadata?: Record<string, unknown>;
}
