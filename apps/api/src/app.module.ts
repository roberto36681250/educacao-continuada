import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InvitesModule } from './invites/invites.module';
import { InstitutesModule } from './institutes/institutes.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { UnitsModule } from './units/units.module';
import { CoursesModule } from './courses/courses.module';
import { ModulesModule } from './modules/modules.module';
import { LessonsModule } from './lessons/lessons.module';
import { QuizzesModule } from './quizzes/quizzes.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { CertificatesModule } from './certificates/certificates.module';
import { TicketsModule } from './tickets/tickets.module';
import { FAQModule } from './faq/faq.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    InvitesModule,
    InstitutesModule,
    HospitalsModule,
    UnitsModule,
    CoursesModule,
    ModulesModule,
    LessonsModule,
    QuizzesModule,
    AssignmentsModule,
    CertificatesModule,
    TicketsModule,
    FAQModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
