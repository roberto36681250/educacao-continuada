import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreateUnitDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsString()
  hospitalId: string;
}
