import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

// Fields to redact from logs (LGPD compliance)
const REDACT_FIELDS = [
  'password',
  'passwordHash',
  'cpf',
  'rawText',
  'accessToken',
  'token',
  'authorization',
  'cookie',
];

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get('NODE_ENV') === 'production';

        return {
          pinoHttp: {
            genReqId: (req: any) => req.headers['x-request-id'] || uuidv4(),
            customProps: (req: any) => ({
              requestId: req.id,
              userId: req.user?.id,
            }),
            redact: {
              paths: REDACT_FIELDS.map((f) => `req.body.${f}`)
                .concat(REDACT_FIELDS.map((f) => `req.headers.${f}`))
                .concat(['req.headers.authorization']),
              censor: '[REDACTED]',
            },
            serializers: {
              req: (req: any) => ({
                id: req.id,
                method: req.method,
                url: req.url,
                query: req.query,
                params: req.params,
                // Don't log body to avoid sensitive data leaks
              }),
              res: (res: any) => ({
                statusCode: res.statusCode,
              }),
            },
            customLogLevel: (req: any, res: any, err: any) => {
              if (res.statusCode >= 500 || err) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },
            customSuccessMessage: (req: any, res: any) => {
              return `${req.method} ${req.url} ${res.statusCode}`;
            },
            customErrorMessage: (req: any, res: any, err: any) => {
              return `${req.method} ${req.url} ${res.statusCode} - ${err?.message || 'Error'}`;
            },
            transport: isProduction
              ? undefined // JSON in production
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'HH:MM:ss',
                    ignore: 'pid,hostname',
                  },
                },
            level: configService.get('LOG_LEVEL') || 'info',
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class LoggingModule {}
