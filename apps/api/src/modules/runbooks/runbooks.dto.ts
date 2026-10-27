import { IsOptional, IsString } from 'class-validator';

export class CreateRunbookDto {
  @IsString() title!: string;
  @IsOptional() @IsString() serviceId?: string;
  @IsOptional() @IsString() category?: string;
  @IsString() contentMd!: string;
}

export class UpdateRunbookDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() contentMd?: string;
  @IsOptional() @IsString() serviceId?: string;
}
