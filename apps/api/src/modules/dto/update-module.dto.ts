import { IsString, IsOptional, MinLength, MaxLength, IsEnum, IsInt, Min } from 'class-validator';
import { ContentStatus } from '@prisma/client';

export class UpdateModuleDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
