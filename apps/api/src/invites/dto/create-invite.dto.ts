import { IsEmail, IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateInviteDto {
  @IsString()
  instituteId: string;

  @IsEmail()
  @IsOptional()
  invitedEmail?: string;

  @IsEnum(UserRole)
  @IsOptional()
  systemRole?: UserRole = UserRole.USER;

  @IsString()
  profession: string;

  @IsString()
  @IsOptional()
  hospitalId?: string;

  @IsString()
  @IsOptional()
  unitId?: string;

  @IsInt()
  @Min(1)
  @Max(30)
  @IsOptional()
  expiresInDays?: number = 7;
}
