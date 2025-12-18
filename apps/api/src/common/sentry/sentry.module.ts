import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'SENTRY_INITIALIZED',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dsn = configService.get<string>('SENTRY_DSN');
        const environment = configService.get<string>('NODE_ENV') || 'development';

        if (dsn) {
          Sentry.init({
            dsn,
            environment,
            tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
            profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
            integrations: [
              Sentry.httpIntegration(),
              Sentry.expressIntegration(),
            ],
            beforeSend(event) {
              // Remove sensitive data from events
              if (event.request?.data && typeof event.request.data === 'object') {
                const sensitiveFields = ['password', 'passwordHash', 'cpf', 'rawText', 'accessToken'];
                const data = event.request.data as Record<string, unknown>;
                for (const field of sensitiveFields) {
                  if (field in data) {
                    data[field] = '[REDACTED]';
                  }
                }
              }
              return event;
            },
          });
          console.log('Sentry initialized');
          return true;
        }

        console.log('Sentry DSN not configured - error tracking disabled');
        return false;
      },
    },
  ],
  exports: ['SENTRY_INITIALIZED'],
})
export class SentryModule {}
