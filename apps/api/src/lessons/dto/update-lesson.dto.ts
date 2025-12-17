import { IsString, IsOptional, MinLength, MaxLength, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ContentStatus } from '@prisma/client';

export class UpdateLessonDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @IsOptional()
  youtubeVideoId?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  durationSeconds?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  minWatchPercent?: number;

  @IsEnum(ContentStatus)
  @IsOptional()
  status?: ContentStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
