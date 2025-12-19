import { Module } from '@nestjs/common';
import { InstitutesController, UsersController } from './institutes.controller';
import { InstitutesService } from './institutes.service';

@Module({
  controllers: [InstitutesController, UsersController],
  providers: [InstitutesService],
})
export class InstitutesModule {}
