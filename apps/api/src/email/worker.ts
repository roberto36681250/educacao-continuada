/**
 * Standalone Email Worker
 *
 * Executa o processamento da fila de emails em background.
 * Pode ser executado via: pnpm worker:email
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, EmailOutboxStatus, EmailAuditAction } from '@prisma/client';
import { Resend } from 'resend';

// Setup
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const resend = new Resend(process.env.RESEND_API_KEY);

const POLLING_INTERVAL = 5000; // 5 segundos
const BATCH_SIZE = 10;
const FROM_EMAIL = process.env.EMAIL_FROM || 'Educacao Continuada <noreply@educacaocontinuada.com.br>';

// Backoff delays em ms
const BACKOFF_DELAYS = [0, 60000, 300000, 1800000]; // 0, 1min, 5min, 30min

function log(message: string) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function renderTemplate(
  htmlBody: string,
  textBody: string,
  payload: Record<string, any>,
): Promise<{ html: string; text: string }> {
  let html = htmlBody;
  let text = textBody;

  for (const [key, value] of Object.entries(payload)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    html = html.replace(regex, String(value));
    text = text.replace(regex, String(value));
  }

  return { html, text };
}

async function canSendToUser(userId: string): Promise<boolean> {
  const pref = await prisma.emailPreference.findUnique({
    where: { userId },
  });

  // Se nao tem preferencia, permitir (default: emailEnabled = true)
  if (!pref) return true;

  return pref.emailEnabled;
}

async function processEmail(outbox: any): Promise<void> {
  const { id, toEmail, toName, templateKey, templateVersion, payload } = outbox;

  try {
    // Buscar template
    const template = await prisma.emailTemplate.findFirst({
      where: {
        key: templateKey,
        version: templateVersion,
      },
    });

    if (!template) {
      throw new Error(`Template nao encontrado: ${templateKey} v${templateVersion}`);
    }

    // Renderizar template
    const { html, text } = await renderTemplate(
      template.htmlBody,
      template.textBody,
      payload as Record<string, any>,
    );

    // Enviar via Resend
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: template.subject.replace(/\{\{(\w+)\}\}/g, (_, key) => (payload as any)[key] || ''),
      html,
      text,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Sucesso
    await prisma.emailOutbox.update({
      where: { id },
      data: {
        status: EmailOutboxStatus.SENT,
        sentAt: new Date(),
        providerMessageId: result.data?.id,
      },
    });

    await prisma.emailAudit.create({
      data: {
        outboxId: id,
        action: EmailAuditAction.SENT,
        meta: { providerMessageId: result.data?.id },
      },
    });

    log(`Enviado: ${templateKey} -> ${toEmail}`);
  } catch (error: any) {
    // Falha
    const attempts = outbox.attempts + 1;
    const shouldCancel = attempts >= 4;

    await prisma.emailOutbox.update({
      where: { id },
      data: {
        status: shouldCancel ? EmailOutboxStatus.CANCELLED : EmailOutboxStatus.FAILED,
        attempts,
        lastError: error.message,
        // Agendar proxima tentativa com backoff
        scheduledAt: shouldCancel
          ? undefined
          : new Date(Date.now() + (BACKOFF_DELAYS[attempts] || BACKOFF_DELAYS[3])),
      },
    });

    await prisma.emailAudit.create({
      data: {
        outboxId: id,
        action: EmailAuditAction.FAILED,
        meta: { error: error.message, attempt: attempts },
      },
    });

    log(`Falhou (tentativa ${attempts}): ${templateKey} -> ${toEmail}: ${error.message}`);
  }
}

async function processBatch(): Promise<number> {
  // Buscar emails pendentes
  const pending = await prisma.emailOutbox.findMany({
    where: {
      status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.FAILED] },
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return 0;
  }

  log(`Processando ${pending.length} emails...`);

  for (const outbox of pending) {
    // Marcar como SENDING
    await prisma.emailOutbox.update({
      where: { id: outbox.id },
      data: { status: EmailOutboxStatus.SENDING },
    });

    // Verificar preferencias do usuario (se tivermos userId no payload)
    // Por enquanto, processar sempre

    await processEmail(outbox);
  }

  return pending.length;
}

async function main() {
  log('Worker de email iniciado');
  log(`Polling interval: ${POLLING_INTERVAL}ms`);
  log(`Batch size: ${BATCH_SIZE}`);

  // Verificar conexao com Resend
  if (!process.env.RESEND_API_KEY) {
    log('AVISO: RESEND_API_KEY nao configurada. Emails nao serao enviados.');
  }

  // Loop principal
  while (true) {
    try {
      const processed = await processBatch();
      if (processed > 0) {
        log(`Batch concluido: ${processed} emails processados`);
      }
    } catch (error: any) {
      log(`Erro no batch: ${error.message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLLING_INTERVAL));
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  log('Encerrando worker...');
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('Encerrando worker...');
  await prisma.$disconnect();
  await pool.end();
  process.exit(0);
});

main().catch((error) => {
  log(`Erro fatal: ${error.message}`);
  process.exit(1);
});
