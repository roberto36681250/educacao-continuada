import { IsString, IsOptional, MinLength, MaxLength, IsEnum } from 'class-validator';
import { ContentStatus } from '@prisma/client';

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  instituteId: string;

  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;
}
