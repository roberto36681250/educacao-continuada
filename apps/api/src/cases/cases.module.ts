import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AnonymizationRulesModule } from '../anonymization-rules/anonymization-rules.module';

@Module({
  imports: [PrismaModule, AnonymizationRulesModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
