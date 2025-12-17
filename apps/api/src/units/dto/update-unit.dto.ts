import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateUnitDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;
}
