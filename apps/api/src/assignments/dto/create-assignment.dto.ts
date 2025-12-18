import {
  IsString,
  IsDateString,
  IsArray,
  ValidateNested,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ScopeType {
  INSTITUTE_PROFESSION = 'INSTITUTE_PROFESSION',
  UNIT_ALL = 'UNIT_ALL',
  UNIT_PROFESSION = 'UNIT_PROFESSION',
}

export class AssignmentScopeDto {
  @IsEnum(ScopeType)
  scopeType: ScopeType;

  @IsString()
  @IsOptional()
  unitId?: string;

  @IsString()
  @IsOptional()
  profession?: string;
}

export class CreateAssignmentDto {
  @IsString()
  courseId: string;

  @IsString()
  title: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  dueAt: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentScopeDto)
  scopes: AssignmentScopeDto[];
}
