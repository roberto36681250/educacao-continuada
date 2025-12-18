# Sistema de E-mails - Educacao Continuada

Este documento descreve a arquitetura e funcionamento do sistema de e-mails.

## Visao Geral

O sistema utiliza o padrao **Outbox** para garantir entrega confiavel de emails:

1. Emails sao enfileirados no banco de dados (tabela `email_outbox`)
2. Um worker processa a fila em background
3. Emails sao enviados via API do Resend
4. Auditoria completa de todos os eventos

## Stack

- **Provedor**: Resend (API)
- **Fila**: PostgreSQL via Prisma (tabela email_outbox)
- **Worker**: Processo separado com polling de 5s
- **Templates**: Armazenados no banco com versionamento

---

## Modelos de Dados

### EmailTemplate

Armazena templates de email com versionamento:

```prisma
model EmailTemplate {
  id              String   @id
  key             String   @unique  // INVITE_CREATED, WEEKLY_DIGEST, etc.
  version         Int      @default(1)
  subject         String
  htmlBody        String   @db.Text
  textBody        String   @db.Text
  variablesSchema Json     // Schema das variaveis do template
  isActive        Boolean  @default(true)
  createdByUserId String?
  createdAt       DateTime
  updatedAt       DateTime
}
```

### EmailOutbox

Fila de emails para envio:

```prisma
model EmailOutbox {
  id                String            @id
  instituteId       String
  eventKey          String            // Tipo do evento
  toEmail           String
  toName            String?
  templateKey       String
  templateVersion   Int
  payload           Json              // Variaveis para o template
  dedupKey          String            // Chave de deduplicacao
  status            EmailOutboxStatus // PENDING, SENDING, SENT, FAILED, CANCELLED, SKIPPED
  scheduledAt       DateTime
  sentAt            DateTime?
  attempts          Int               @default(0)
  lastError         String?
  providerMessageId String?           // ID do Resend
}
```

### EmailPreference

Preferencias de email do usuario:

```prisma
model EmailPreference {
  id               String   @id
  userId           String   @unique
  emailEnabled     Boolean  @default(true)   // Master switch
  digestEnabled    Boolean  @default(true)   // Resumo semanal
  remindersEnabled Boolean  @default(true)   // Lembretes de prazo
}
```

---

## Templates Disponiveis

| Key | Descricao | Variaveis |
|-----|-----------|-----------|
| `INVITE_CREATED` | Convite para plataforma | userName, hospitalName, unitName, inviteUrl |
| `ASSIGNMENT_DUE_SOON` | Lembrete de prazo proximo | userName, courseName, dueDate, progress, courseUrl |
| `ASSIGNMENT_OVERDUE` | Treinamento em atraso | userName, courseName, dueDate, progress, courseUrl |
| `REVIEW_DUE` | Revisao pendente (gestor) | reviewerName, studentName, competencyName, submittedDate, reviewUrl |
| `WEEKLY_DIGEST` | Resumo semanal | userName, activeUsers, completedLessons, quizzesCompleted, certificatesIssued, overdueCount, pendingReviews, dashboardUrl |

---

## Deduplicacao

Para evitar spam, cada email possui uma `dedupKey` unica:

- Convite: `invite-{inviteId}`
- Prazo proximo: `assignment-due-soon-{assignmentId}-{date}`
- Em atraso: `assignment-overdue-{assignmentId}-{date}`
- Revisao: `review-due-{reviewId}-{gestorId}-{date}`
- Digest: `weekly-digest-{userId}-{weekStart}-{weekEnd}`

Se um email com a mesma dedupKey ja existir, o novo e marcado como SKIPPED.

---

## Retry com Backoff

Quando um envio falha:

1. Primeira tentativa: imediato
2. Segunda tentativa: +1 minuto
3. Terceira tentativa: +5 minutos
4. Quarta tentativa: +30 minutos
5. Apos 4 falhas: status CANCELLED

---

## API Endpoints

### Templates (Gestor)

```
GET    /gestor/email-templates         # Listar templates
POST   /gestor/email-templates         # Criar template
PATCH  /gestor/email-templates/:id     # Atualizar template
```

### Preferencias (Usuario)

```
GET    /me/email-preferences           # Obter preferencias
PATCH  /me/email-preferences           # Atualizar preferencias
```

### Fila (Gestor)

```
GET    /gestor/comunicacao/fila              # Ver fila de emails
GET    /gestor/comunicacao/estatisticas      # Estatisticas da fila
POST   /gestor/comunicacao/reenviar/:id      # Reenviar email falho
POST   /gestor/comunicacao/processar         # Processar fila manualmente
POST   /gestor/comunicacao/scheduler/daily-reminders  # Executar lembretes
POST   /gestor/comunicacao/scheduler/weekly-digest    # Executar digest
```

---

## Worker

O worker roda como processo separado e:

1. Busca emails PENDING com `scheduledAt <= now`
2. Marca como SENDING
3. Renderiza template com variaveis
4. Envia via Resend API
5. Marca como SENT ou FAILED
6. Registra auditoria

### Executar Worker

```bash
cd apps/api
pnpm worker:email
```

Ou via API para testes:
```bash
curl -X POST http://localhost:3001/gestor/comunicacao/processar
```

---

## Schedulers

Os schedulers devem ser executados via cron externo ou manualmente:

### Lembretes Diarios (08:00)

```bash
curl -X POST http://localhost:3001/gestor/comunicacao/scheduler/daily-reminders
```

Executa:
- Lembrete de prazo proximo (3 dias)
- Lembrete de atraso
- Revisoes pendentes

### Digest Semanal (Segunda 08:30)

```bash
curl -X POST http://localhost:3001/gestor/comunicacao/scheduler/weekly-digest
```

Envia resumo semanal para GESTORs e ADMIN_MASTERs.

---

## Configuracao

### Variaveis de Ambiente

```env
# Resend API Key
RESEND_API_KEY=re_xxxx

# URL base para links nos emails
WEB_URL=https://app.seudominio.com

# Email remetente
EMAIL_FROM=Educacao Continuada <noreply@seudominio.com>
```

### Seed de Templates

Os templates sao criados automaticamente no seed:

```bash
cd apps/api
npx prisma db seed
```

---

## Interface Web

### /gestor/comunicacao

Painel para gestores visualizarem:
- Estatisticas da fila
- Lista de emails com filtros
- Reenvio de emails falhos
- Execucao manual de schedulers

### /preferencias

Pagina para usuarios configurarem:
- Ativar/desativar emails
- Ativar/desativar lembretes
- Ativar/desativar digest semanal

---

## Auditoria

Todos os eventos sao registrados na tabela `email_audits`:

| Action | Descricao |
|--------|-----------|
| ENQUEUED | Email adicionado a fila |
| SENT | Email enviado com sucesso |
| FAILED | Envio falhou |
| SKIPPED | Ignorado (duplicado ou preferencia) |

---

## Fluxo de Envio

```
1. Evento ocorre (ex: convite criado)
   |
2. EmailEnqueueService.enqueue()
   |-- Verifica deduplicacao
   |-- Valida payload vs template
   |-- Cria registro em email_outbox
   |-- Registra auditoria ENQUEUED
   |
3. Worker processa (polling 5s)
   |-- Busca PENDING
   |-- Verifica preferencias do usuario
   |-- Renderiza template
   |-- Envia via Resend
   |-- Atualiza status
   |-- Registra auditoria
```

---

## Troubleshooting

### Email nao chegou

1. Verificar status na fila: `/gestor/comunicacao`
2. Se FAILED, ver lastError
3. Se SKIPPED, verificar dedupKey ou preferencias
4. Se PENDING, verificar se worker esta rodando

### Worker nao processa

1. Verificar RESEND_API_KEY
2. Verificar conexao com banco
3. Verificar logs do worker

### Template nao renderiza

1. Verificar variablesSchema do template
2. Verificar payload enviado no enqueue
3. Verificar sintaxe {{variavel}} no template

---

*Ultima atualizacao: Dezembro 2024*
