import { Module } from '@nestjs/common';
import { AnonymizationRulesService } from './anonymization-rules.service';
import { AnonymizationRulesController } from './anonymization-rules.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnonymizationRulesController],
  providers: [AnonymizationRulesService],
  exports: [AnonymizationRulesService],
})
export class AnonymizationRulesModule {}
