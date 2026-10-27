import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateIncidentDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() serviceId?: string;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class TransitionDto {
  @IsIn(['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'REOPENED']) status!: 'OPEN' | 'ACKNOWLEDGED' | 'INVESTIGATING' | 'RESOLVED' | 'REOPENED';
}

export class CommentDto {
  @IsString() body!: string;
}

export class AssignDto {
  @IsString() userId!: string;
}
