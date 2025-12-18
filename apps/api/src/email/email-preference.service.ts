import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailPreferenceService {
  constructor(private prisma: PrismaService) {}

  async getOrCreate(userId: string) {
    let preference = await this.prisma.emailPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      preference = await this.prisma.emailPreference.create({
        data: {
          userId,
          emailEnabled: true,
          digestEnabled: true,
          remindersEnabled: true,
        },
      });
    }

    return preference;
  }

  async update(
    userId: string,
    data: {
      emailEnabled?: boolean;
      digestEnabled?: boolean;
      remindersEnabled?: boolean;
    },
  ) {
    // Ensure record exists
    await this.getOrCreate(userId);

    return this.prisma.emailPreference.update({
      where: { userId },
      data,
    });
  }

  async canSendEmail(userId: string): Promise<boolean> {
    const preference = await this.getOrCreate(userId);
    return preference.emailEnabled;
  }

  async canSendReminder(userId: string): Promise<boolean> {
    const preference = await this.getOrCreate(userId);
    return preference.emailEnabled && preference.remindersEnabled;
  }

  async canSendDigest(userId: string): Promise<boolean> {
    const preference = await this.getOrCreate(userId);
    return preference.emailEnabled && preference.digestEnabled;
  }
}
