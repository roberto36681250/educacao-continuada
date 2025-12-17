import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InvitesService } from './invites.service';
import { InvitesController } from './invites.controller';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [InvitesController],
  providers: [InvitesService],
})
export class InvitesModule {}
