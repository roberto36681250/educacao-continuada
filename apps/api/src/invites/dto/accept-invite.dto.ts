import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class AcceptInviteDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos' })
  cpf: string;

  @IsString()
  @Matches(/^\d{10,11}$/, { message: 'Telefone deve conter 10 ou 11 dígitos' })
  phone: string;

  @IsString()
  @IsString()
  registry: string;

  @IsString()
  @MinLength(6)
  password: string;
}
