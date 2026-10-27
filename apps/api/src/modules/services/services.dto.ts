import { IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() healthCheckUrl?: string;
  @IsOptional() @IsInt() @Min(15) @Max(3600) checkIntervalSec?: number;
  @IsOptional() @IsInt() @Min(1000) @Max(60000) timeoutMs?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) failureThreshold?: number;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() healthCheckUrl?: string;
  @IsOptional() @IsInt() @Min(15) @Max(3600) checkIntervalSec?: number;
  @IsOptional() @IsInt() @Min(1000) @Max(60000) timeoutMs?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) failureThreshold?: number;
  @IsOptional() archived?: boolean;
}
