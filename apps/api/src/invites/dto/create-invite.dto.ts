import { IsEmail, IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateInviteDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsEnum(UserRole)
  systemRole: UserRole;

  @IsString()
  profession: string;

  @IsString()
  @IsOptional()
  registry?: string;

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
