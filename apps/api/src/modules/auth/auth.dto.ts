import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { PASSWORD_RULE_MESSAGE } from './password-policy';

export class RegisterDto {
  @IsString() @MinLength(1) name!: string;
  @IsEmail() email!: string;
  @IsString() @Length(8, 8, { message: PASSWORD_RULE_MESSAGE }) password!: string;
  @IsString() confirmPassword!: string;
  // Optional: when absent the server derives "<name>'s workspace". Never grants
  // privileges beyond OWNER of the newly created organization.
  @IsOptional() @IsString() orgName?: string;
}

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

export class UpdateProfileDto {
  @IsString() @MinLength(1) name!: string;
}

export class ForgotPasswordDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(16) token!: string;
  @IsString() @Length(8, 8, { message: PASSWORD_RULE_MESSAGE }) password!: string;
  @IsString() confirmPassword!: string;
}
