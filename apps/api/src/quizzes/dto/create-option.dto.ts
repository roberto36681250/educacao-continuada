import { IsString, IsBoolean, IsOptional, IsInt, Min } from 'class-validator';

export class CreateOptionDto {
  @IsString()
  questionId: string;

  @IsString()
  text: string;

  @IsBoolean()
  @IsOptional()
  isCorrect?: boolean = false;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateOptionDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsBoolean()
  @IsOptional()
  isCorrect?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
