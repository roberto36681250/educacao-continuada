import { IsString, IsEnum, IsBoolean, IsOptional, IsInt, Min } from 'class-validator';

export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  MULTIPLE_SELECT = 'MULTIPLE_SELECT',
  CASE = 'CASE',
}

export class CreateQuestionDto {
  @IsString()
  quizId: string;

  @IsString()
  text: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType = QuestionType.MULTIPLE_CHOICE;

  @IsBoolean()
  @IsOptional()
  justificationRequired?: boolean = false;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateQuestionDto {
  @IsString()
  @IsOptional()
  text?: string;

  @IsEnum(QuestionType)
  @IsOptional()
  type?: QuestionType;

  @IsBoolean()
  @IsOptional()
  justificationRequired?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
