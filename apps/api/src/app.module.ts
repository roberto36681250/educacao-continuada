import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { InvitesModule } from './invites/invites.module';
import { InstitutesModule } from './institutes/institutes.module';
import { HospitalsModule } from './hospitals/hospitals.module';
import { UnitsModule } from './units/units.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    InvitesModule,
    InstitutesModule,
    HospitalsModule,
    UnitsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
