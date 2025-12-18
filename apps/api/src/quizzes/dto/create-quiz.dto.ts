import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateQuizDto {
  @IsString()
  lessonId: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  minScore?: number = 70;
}
