import { Module } from '@nestjs/common';
import { FAQController } from './faq.controller';
import { FAQService } from './faq.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FAQController],
  providers: [FAQService],
  exports: [FAQService],
})
export class FAQModule {}
