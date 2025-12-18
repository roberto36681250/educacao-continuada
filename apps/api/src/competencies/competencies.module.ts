import { Module } from '@nestjs/common';
import { CompetenciesController } from './competencies.controller';
import { CompetenciesService } from './competencies.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CompetenciesController],
  providers: [CompetenciesService],
  exports: [CompetenciesService],
})
export class CompetenciesModule {}
