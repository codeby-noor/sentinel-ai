import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateOrgDto {
  @IsString() @MinLength(1) name!: string;
}

export class InviteDto {
  @IsString() @MinLength(3) email!: string;
  @IsIn(['ADMIN', 'MEMBER']) role!: 'ADMIN' | 'MEMBER';
}

export class UpdateMemberDto {
  @IsIn(['ADMIN', 'MEMBER', 'OWNER']) role!: 'ADMIN' | 'MEMBER' | 'OWNER';
}

export class UpdateOrgDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
}
