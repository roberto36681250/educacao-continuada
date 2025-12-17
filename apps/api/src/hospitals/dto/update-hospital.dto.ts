import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateHospitalDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;
}
