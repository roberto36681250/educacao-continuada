# Deploy Guide - Educacao Continuada

## Stack de Producao

| Componente | Servico | Plano |
|------------|---------|-------|
| Database | Supabase | Free/Pro |
| API | Render Web Service | Starter |
| Email Worker | Render Background Worker | Starter |
| Web | Vercel | Free/Pro |

---

## 1. Supabase (Database)

### Configuracao inicial

1. Crie um projeto no [Supabase](https://supabase.com)
2. Va em **Settings > Database > Connection string**
3. Copie as duas URLs:

```env
# Pooler (para conexoes da aplicacao)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direta (para migrations)
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

### Primeira execucao (migrations)

```bash
cd apps/api
npx prisma migrate deploy
npx prisma db seed
```

---

## 2. Render (API + Worker)

### Opcao A: Deploy via Blueprint

1. Conecte o repositorio ao Render
2. Importe `render.yaml` (ja configurado)
3. Configure as variaveis de ambiente (sync: false)

### Opcao B: Deploy Manual

#### API - Web Service

**Build Command:**
```bash
pnpm install --frozen-lockfile
pnpm --filter api prisma generate
pnpm --filter api build
```

**Start Command:**
```bash
pnpm --filter api start:prod
```

**Health Check Path:** `/health`

**Environment Variables:**
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...pooler...
DIRECT_URL=postgresql://...direta...
JWT_SECRET=<gerar-com-openssl-rand-base64-32>
SENTRY_DSN=https://...@sentry.io/...
RESEND_API_KEY=re_...
EMAIL_FROM=Educacao Continuada <no-reply@seu-dominio.com>
APP_BASE_URL=https://seu-projeto.vercel.app
WEB_URL=https://seu-projeto.vercel.app
EMAIL_WORKER_ENABLED=false
```

#### Email Worker - Background Worker

**Build Command:**
```bash
pnpm install --frozen-lockfile
pnpm --filter api prisma generate
```

**Start Command:**
```bash
pnpm --filter api worker:email
```

**Environment Variables:**
Mesmas da API, mas com:
```env
EMAIL_WORKER_ENABLED=true
```

### Migrations em Producao

No Render Shell ou via Deploy Hook:
```bash
pnpm --filter api prisma migrate deploy
```

---

## 3. Vercel (Web)

### Configuracao

1. Importe o repositorio no Vercel
2. Configure:
   - **Framework:** Next.js
   - **Root Directory:** `apps/web`

### Environment Variables

```env
NEXT_PUBLIC_API_URL=https://educacao-continuada-api.onrender.com
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

---

## 4. Configuracao de Email (Resend)

### DNS Records

Para evitar spam, configure no seu dominio:

| Tipo | Nome | Valor |
|------|------|-------|
| TXT | @ | `v=spf1 include:_spf.resend.com ~all` |
| CNAME | resend._domainkey | `[chave-do-resend].dkim.resend.dev` |

### Verificacao

1. Acesse [Resend Dashboard](https://resend.com/domains)
2. Verifique o dominio
3. Teste com `POST /gestor/comunicacao/processar`

---

## Environment Variables - Referencia Completa

### API (`apps/api`)

| Variavel | Obrigatorio | Descricao |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL do pooler PostgreSQL |
| `DIRECT_URL` | Sim | URL direta para migrations |
| `JWT_SECRET` | Sim | Chave secreta para tokens (min 32 chars) |
| `JWT_EXPIRES_IN` | Nao | Duracao do token (default: 7d) |
| `WEB_URL` | Sim | URL do frontend (CORS) |
| `APP_BASE_URL` | Sim | URL base para links em emails |
| `RESEND_API_KEY` | Sim* | API key do Resend |
| `EMAIL_FROM` | Sim* | Endereco de envio |
| `EMAIL_WORKER_ENABLED` | Nao | Ativa processamento de emails |
| `SENTRY_DSN` | Nao | DSN do Sentry para erro tracking |
| `PORT` | Nao | Porta da API (default: 3001) |
| `NODE_ENV` | Nao | production/development |

*Obrigatorio se usar emails

### Web (`apps/web`)

| Variavel | Obrigatorio | Descricao |
|----------|-------------|-----------|
| `NEXT_PUBLIC_API_URL` | Sim | URL da API |
| `NEXT_PUBLIC_SENTRY_DSN` | Nao | DSN do Sentry |

---

## Health Checks

### API

```bash
# Basico (publico)
curl https://sua-api.onrender.com/health

# Detalhado (requer auth admin)
curl -H "Authorization: Bearer $TOKEN" \
  https://sua-api.onrender.com/health/detailed
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": { "status": "ok", "latencyMs": 5 },
    "worker": { "status": "ok", "queueStats": {...} }
  }
}
```

---

## Checklist de Validacao Pos-Deploy

### Infraestrutura
- [ ] API responde em `/health`
- [ ] Worker esta rodando (ver logs)
- [ ] Web carrega sem erros

### Fluxo Completo
1. [ ] Admin faz login
2. [ ] Admin cria hospital e unidade
3. [ ] Admin cria convite
4. [ ] Email de convite chega
5. [ ] Usuario aceita convite
6. [ ] Gestor cria atribuicao
7. [ ] Email de lembrete e enviado (ou disparar manualmente)
8. [ ] Usuario completa curso
9. [ ] Usuario emite certificado
10. [ ] QR do certificado valida corretamente

### Verificacoes de Seguranca
- [ ] CORS permite apenas WEB_URL
- [ ] Rate limiting esta ativo (testar login)
- [ ] JWT expira corretamente
- [ ] Endpoints admin requerem role correto

---

## Monitoring

### Logs (Render)

```bash
# Ver logs da API
render logs educacao-continuada-api

# Ver logs do worker
render logs educacao-continuada-worker
```

### Sentry

- Erros 5xx sao capturados automaticamente
- Contexto de usuario e incluido
- Campos sensiveis sao removidos

### Email Queue

Acesse `/gestor/comunicacao` no frontend para:
- Ver emails pendentes/enviados/falhados
- Reenviar emails falhados
- Processar fila manualmente

---

## Troubleshooting

### API nao inicia

1. Verificar logs no Render
2. Checar `DATABASE_URL` esta correto
3. Verificar se migrations foram aplicadas

### Emails nao enviam

1. Verificar `RESEND_API_KEY` esta configurado
2. Verificar `EMAIL_WORKER_ENABLED=true` no worker
3. Ver logs do worker para erros
4. Verificar dominio verificado no Resend

### CORS errors

1. Verificar `WEB_URL` na API
2. URL deve incluir protocolo (https://)
3. Nao incluir barra final

### Certificado com QR invalido

1. Verificar `APP_BASE_URL` esta correto
2. URL deve ser a mesma do frontend publico

---

## Backup e Recovery

### Database

Supabase faz backups automaticos. Para backup manual:
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Arquivos

```bash
# Certificados e anexos
tar -czvf storage-backup.tar.gz apps/api/storage/
```

### Rollback

1. Parar servicos no Render
2. Restaurar backup do banco se necessario
3. Fazer redeploy da versao anterior via Git
4. Reiniciar servicos
