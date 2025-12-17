import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateHospitalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsString()
  instituteId: string;
}
