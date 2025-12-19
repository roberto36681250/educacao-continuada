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
  INSTITUTE_ALL = 'INSTITUTE_ALL', // Todos os usuários do instituto
  INSTITUTE_PROFESSION = 'INSTITUTE_PROFESSION', // Todos de uma profissão no instituto
  HOSPITAL_ALL = 'HOSPITAL_ALL', // Todos os usuários de um hospital
  UNIT_ALL = 'UNIT_ALL', // Todos os usuários de uma unidade
  UNIT_PROFESSION = 'UNIT_PROFESSION', // Profissão específica em uma unidade
  INDIVIDUAL = 'INDIVIDUAL', // Usuários específicos selecionados
}

export class AssignmentScopeDto {
  @IsEnum(ScopeType)
  scopeType: ScopeType;

  @IsString()
  @IsOptional()
  unitId?: string;

  @IsString()
  @IsOptional()
  hospitalId?: string;

  @IsString()
  @IsOptional()
  profession?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userIds?: string[];
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
