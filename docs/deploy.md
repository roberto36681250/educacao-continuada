# Deploy Guide - Educacao Continuada

## Environment Variables

### API (`apps/api/.env`)

```env
# Database (required)
DATABASE_URL="postgresql://user:password@host:port/database?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:port/database"

# JWT (required)
JWT_SECRET="your-secure-secret-min-32-chars"
JWT_EXPIRES_IN="7d"

# Web URL (required for CORS and email links)
WEB_URL="https://your-domain.com"

# Email - Resend (optional, emails will fail without)
RESEND_API_KEY="re_xxxxx"
EMAIL_FROM="noreply@your-domain.com"
EMAIL_WORKER_ENABLED="true"

# Sentry (optional, error tracking)
SENTRY_DSN="https://xxxxx@sentry.io/xxxxx"
NODE_ENV="production"

# Rate limiting (optional)
THROTTLE_LIMIT="100"

# Logging (optional)
LOG_LEVEL="info"

# Port (optional, default 3001)
PORT="3001"
```

### Web (`apps/web/.env.local`)

```env
# API URL
NEXT_PUBLIC_API_URL="https://api.your-domain.com"

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN="https://xxxxx@sentry.io/xxxxx"
SENTRY_ORG="your-org"
SENTRY_PROJECT="your-project"

# Production mode
NODE_ENV="production"
```

## Deployment Order

1. **Database**
   - Ensure PostgreSQL is running
   - Create database if not exists
   - Configure pooler (Supabase Session Pooler recommended)

2. **Run Migrations**
   ```bash
   cd apps/api
   npx prisma migrate deploy
   ```

3. **Seed Data (first deploy only)**
   ```bash
   cd apps/api
   npx prisma db seed
   ```

4. **Start API**
   ```bash
   cd apps/api
   pnpm run start:prod
   # or with pm2
   pm2 start dist/main.js --name api
   ```

5. **Start Email Worker** (separate process)
   ```bash
   cd apps/api
   pnpm run worker:email
   # or with pm2
   pm2 start "pnpm run worker:email" --name email-worker
   ```

6. **Build and Start Web**
   ```bash
   cd apps/web
   pnpm run build
   pnpm run start
   # or with pm2
   pm2 start "pnpm run start" --name web
   ```

## Commands Reference

### Database
```bash
# Push schema changes (dev only)
npx prisma db push

# Generate migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Run seed
npx prisma db seed

# Open Prisma Studio
npx prisma studio
```

### API
```bash
# Development
pnpm run dev

# Build
pnpm run build

# Production
pnpm run start:prod

# Email worker
pnpm run worker:email
```

### Web
```bash
# Development
pnpm run dev

# Build
pnpm run build

# Production
pnpm run start
```

## Health Checks

- **API Basic**: `GET /health`
  - Returns: `{ status: "ok", timestamp, uptime, checks: { database } }`

- **API Detailed** (admin only): `GET /health/detailed`
  - Returns: Basic + worker queue stats

## Monitoring

### Sentry Integration
- API errors are automatically captured
- Web errors are captured via global-error.tsx
- User context is set on login

### Logs
- API uses structured JSON logging (pino)
- Request ID correlation via `x-request-id` header
- Sensitive fields (password, cpf, etc.) are redacted

### Email Queue
- View queue: `GET /gestor/comunicacao/fila`
- View stats: `GET /gestor/comunicacao/estatisticas`
- Manual process: `POST /gestor/comunicacao/processar`
- Retry failed: `POST /gestor/comunicacao/reenviar/:id`

## Scaling Considerations

1. **API**: Stateless, can run multiple instances behind load balancer
2. **Email Worker**: Run single instance to avoid duplicate sends (dedup key handles race conditions)
3. **Database**: Use connection pooler for many connections
4. **Static Assets**: Consider CDN for production

## Backup Strategy

1. **Database**: Daily automated backups via Supabase or custom pg_dump
2. **Uploaded Files**: `apps/api/storage/` directory (tickets attachments)
3. **Certificates**: `apps/api/storage/certificates/` directory

## Rollback Procedure

1. Stop services
2. Restore database backup if needed
3. Checkout previous version
4. Rebuild and restart
