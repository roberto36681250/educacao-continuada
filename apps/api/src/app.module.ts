import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { LoggingModule } from './common/logging';
import { SentryModule } from './common/sentry';
import { ThrottleModule } from './common/throttle';
import { HealthModule } from './health/health.module';
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
import { CompetenciesModule } from './competencies/competencies.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SearchModule } from './search/search.module';
import { HomeModule } from './home/home.module';
import { AnonymizationRulesModule } from './anonymization-rules/anonymization-rules.module';
import { CasesModule } from './cases/cases.module';
import { ContentManagementModule } from './content-management/content-management.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggingModule,
    SentryModule,
    ThrottleModule,
    PrismaModule,
    HealthModule,
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
    CompetenciesModule,
    ReviewsModule,
    SearchModule,
    HomeModule,
    AnonymizationRulesModule,
    CasesModule,
    ContentManagementModule,
    EmailModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
