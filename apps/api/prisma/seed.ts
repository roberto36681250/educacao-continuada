import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando seed...');

  // 1. Criar Instituto único
  const institute = await prisma.institute.upsert({
    where: { id: 'institute-main' },
    update: {},
    create: {
      id: 'institute-main',
      name: 'Educação Continuada',
    },
  });
  console.log('✅ Instituto criado:', institute.name);

  // 2. Criar Hospitais
  const hospital1 = await prisma.hospital.upsert({
    where: { id: 'hospital-1' },
    update: {},
    create: {
      id: 'hospital-1',
      name: 'Hospital Central',
      instituteId: institute.id,
    },
  });

  const hospital2 = await prisma.hospital.upsert({
    where: { id: 'hospital-2' },
    update: {},
    create: {
      id: 'hospital-2',
      name: 'Hospital Norte',
      instituteId: institute.id,
    },
  });
  console.log('✅ Hospitais criados:', hospital1.name, ',', hospital2.name);

  // 3. Criar Unidades
  const utiAdultoA = await prisma.unit.upsert({
    where: { id: 'unit-uti-adulto-a' },
    update: {},
    create: {
      id: 'unit-uti-adulto-a',
      name: 'UTI Adulto A',
      hospitalId: hospital1.id,
    },
  });

  const utiAdultoB = await prisma.unit.upsert({
    where: { id: 'unit-uti-adulto-b' },
    update: {},
    create: {
      id: 'unit-uti-adulto-b',
      name: 'UTI Adulto B',
      hospitalId: hospital1.id,
    },
  });

  const comissaoSepse = await prisma.unit.upsert({
    where: { id: 'unit-comissao-sepse' },
    update: {},
    create: {
      id: 'unit-comissao-sepse',
      name: 'Comissão Sepse',
      hospitalId: hospital1.id,
    },
  });

  const utiNorte = await prisma.unit.upsert({
    where: { id: 'unit-uti-norte' },
    update: {},
    create: {
      id: 'unit-uti-norte',
      name: 'UTI Norte',
      hospitalId: hospital2.id,
    },
  });
  console.log('✅ Unidades criadas:', utiAdultoA.name, ',', utiAdultoB.name, ',', comissaoSepse.name, ',', utiNorte.name);

  // 4. Criar usuário ADMIN_MASTER com senha
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const adminMaster = await prisma.user.upsert({
    where: { email: 'admin@educacaocontinuada.com.br' },
    update: { passwordHash: adminPasswordHash },
    create: {
      id: 'user-admin-master',
      email: 'admin@educacaocontinuada.com.br',
      passwordHash: adminPasswordHash,
      name: 'Administrador Master',
      cpf: '00000000000',
      phone: '11999999999',
      profession: 'Administrador',
      professionalRegister: null,
      role: UserRole.ADMIN_MASTER,
      instituteId: institute.id,
    },
  });
  console.log('✅ Admin Master criado:', adminMaster.email, '(senha: admin123)');

  // 5. Criar usuários de exemplo com profissões diferentes
  const userPasswordHash = await bcrypt.hash('user123', 10);
  const medicoR1 = await prisma.user.upsert({
    where: { email: 'medico.r1@exemplo.com' },
    update: { passwordHash: userPasswordHash },
    create: {
      id: 'user-medico-r1',
      email: 'medico.r1@exemplo.com',
      passwordHash: userPasswordHash,
      name: 'Dr. João Silva',
      cpf: '11111111111',
      phone: '11988888888',
      profession: 'Médico',
      professionalRegister: 'CRM-SP 123456',
      role: UserRole.USER,
      instituteId: institute.id,
    },
  });

  const enfermeira = await prisma.user.upsert({
    where: { email: 'enfermeira@exemplo.com' },
    update: { passwordHash: userPasswordHash },
    create: {
      id: 'user-enfermeira',
      email: 'enfermeira@exemplo.com',
      passwordHash: userPasswordHash,
      name: 'Maria Santos',
      cpf: '22222222222',
      phone: '11977777777',
      profession: 'Enfermeiro',
      professionalRegister: 'COREN-SP 654321',
      role: UserRole.USER,
      instituteId: institute.id,
    },
  });

  const fisioterapeuta = await prisma.user.upsert({
    where: { email: 'fisio@exemplo.com' },
    update: { passwordHash: userPasswordHash },
    create: {
      id: 'user-fisioterapeuta',
      email: 'fisio@exemplo.com',
      passwordHash: userPasswordHash,
      name: 'Carlos Oliveira',
      cpf: '33333333333',
      phone: '11966666666',
      profession: 'Fisioterapeuta',
      professionalRegister: 'CREFITO-3 98765',
      role: UserRole.USER,
      instituteId: institute.id,
    },
  });
  console.log('✅ Usuários criados:', medicoR1.name, ',', enfermeira.name, ',', fisioterapeuta.name);

  // 6. Criar lotações (UserUnitAssignment)
  await prisma.userUnitAssignment.upsert({
    where: { id: 'assignment-medico-uti-a' },
    update: {},
    create: {
      id: 'assignment-medico-uti-a',
      userId: medicoR1.id,
      unitId: utiAdultoA.id,
      isPrimary: true,
      startAt: new Date('2024-01-15'),
    },
  });

  await prisma.userUnitAssignment.upsert({
    where: { id: 'assignment-enfermeira-uti-a' },
    update: {},
    create: {
      id: 'assignment-enfermeira-uti-a',
      userId: enfermeira.id,
      unitId: utiAdultoA.id,
      isPrimary: true,
      startAt: new Date('2024-02-01'),
    },
  });

  await prisma.userUnitAssignment.upsert({
    where: { id: 'assignment-enfermeira-comissao' },
    update: {},
    create: {
      id: 'assignment-enfermeira-comissao',
      userId: enfermeira.id,
      unitId: comissaoSepse.id,
      isPrimary: false,
      startAt: new Date('2024-03-01'),
    },
  });

  await prisma.userUnitAssignment.upsert({
    where: { id: 'assignment-fisio-uti-b' },
    update: {},
    create: {
      id: 'assignment-fisio-uti-b',
      userId: fisioterapeuta.id,
      unitId: utiAdultoB.id,
      isPrimary: true,
      startAt: new Date('2024-01-20'),
    },
  });
  console.log('✅ Lotações criadas');

  // 7. Criar regras de anonimização default (LGPD)
  const anonymizationRules = [
    {
      id: 'rule-cpf',
      name: 'CPF',
      pattern: '\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b',
      replacement: '[CPF]',
      isCritical: true,
      sortOrder: 1,
    },
    {
      id: 'rule-telefone',
      name: 'Telefone',
      pattern: '\\b\\(?\\d{2}\\)?[\\s.-]?\\d{4,5}[\\s.-]?\\d{4}\\b',
      replacement: '[TELEFONE]',
      isCritical: true,
      sortOrder: 2,
    },
    {
      id: 'rule-email',
      name: 'E-mail',
      pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b',
      replacement: '[EMAIL]',
      isCritical: true,
      sortOrder: 3,
    },
    {
      id: 'rule-data',
      name: 'Data',
      pattern: '\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b',
      replacement: '[DATA]',
      isCritical: false,
      sortOrder: 4,
    },
    {
      id: 'rule-prontuario',
      name: 'Prontuário/ID',
      pattern: '\\b\\d{7,}\\b',
      replacement: '[ID]',
      isCritical: false,
      sortOrder: 5,
    },
    {
      id: 'rule-nome-paciente',
      name: 'Nome após título',
      pattern: '(?:Sr\\.?|Sra\\.?|Dr\\.?|Dra\\.?|Paciente:?)\\s+([A-ZÀ-Ú][a-zà-ú]+(?:\\s+[A-ZÀ-Ú][a-zà-ú]+)*)',
      replacement: '[NOME]',
      isCritical: false,
      sortOrder: 6,
    },
    {
      id: 'rule-endereco',
      name: 'Endereço',
      pattern: '(?:Rua|Av\\.?|Avenida|Travessa|Alameda)\\s+[A-Za-zÀ-ú\\s]+,?\\s*(?:n[º°.]?\\s*)?\\d+',
      replacement: '[ENDERECO]',
      isCritical: false,
      sortOrder: 7,
    },
    {
      id: 'rule-cep',
      name: 'CEP',
      pattern: '\\b\\d{5}-?\\d{3}\\b',
      replacement: '[CEP]',
      isCritical: false,
      sortOrder: 8,
    },
    {
      id: 'rule-leito',
      name: 'Leito',
      pattern: '(?:leito|box)\\s*[:\\s]?\\s*\\d+[A-Za-z]?',
      replacement: '[LEITO]',
      isCritical: false,
      sortOrder: 9,
    },
  ];

  for (const rule of anonymizationRules) {
    await prisma.anonymizationRule.upsert({
      where: { id: rule.id },
      update: {
        name: rule.name,
        pattern: rule.pattern,
        replacement: rule.replacement,
        isCritical: rule.isCritical,
        sortOrder: rule.sortOrder,
      },
      create: {
        id: rule.id,
        instituteId: institute.id,
        name: rule.name,
        pattern: rule.pattern,
        replacement: rule.replacement,
        isCritical: rule.isCritical,
        sortOrder: rule.sortOrder,
      },
    });
  }
  console.log('✅ Regras de anonimização criadas:', anonymizationRules.length, 'regras');

  // 8. Criar templates de e-mail
  const emailTemplates = [
    {
      id: 'template-invite-created',
      key: 'INVITE_CREATED',
      subject: 'Convite para Educação Continuada',
      htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2563eb;">Convite para Educação Continuada</h1>
  <p>Olá <strong>{{userName}}</strong>,</p>
  <p>Você foi convidado para participar da plataforma de Educação Continuada.</p>
  <p><strong>Hospital:</strong> {{hospitalName}}</p>
  <p><strong>Unidade:</strong> {{unitName}}</p>
  <p>Para aceitar o convite e criar sua conta, clique no botão abaixo:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{inviteUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Aceitar Convite</a>
  </p>
  <p style="color: #6b7280; font-size: 12px;">Este convite expira em 7 dias.</p>
</body>
</html>`.trim(),
      textBody: `Convite para Educação Continuada

Olá {{userName}},

Você foi convidado para participar da plataforma de Educação Continuada.

Hospital: {{hospitalName}}
Unidade: {{unitName}}

Para aceitar o convite, acesse: {{inviteUrl}}

Este convite expira em 7 dias.`,
      variablesSchema: [
        { name: 'userName', required: true },
        { name: 'hospitalName', required: true },
        { name: 'unitName', required: true },
        { name: 'inviteUrl', required: true },
      ],
    },
    {
      id: 'template-assignment-due-soon',
      key: 'ASSIGNMENT_DUE_SOON',
      subject: 'Lembrete: Treinamento com prazo próximo',
      htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #f59e0b;">Lembrete de Prazo</h1>
  <p>Olá <strong>{{userName}}</strong>,</p>
  <p>Você tem um treinamento com prazo próximo:</p>
  <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Curso:</strong> {{courseName}}</p>
    <p style="margin: 8px 0 0;"><strong>Prazo:</strong> {{dueDate}}</p>
    <p style="margin: 8px 0 0;"><strong>Progresso:</strong> {{progress}}%</p>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{courseUrl}}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Continuar Treinamento</a>
  </p>
</body>
</html>`.trim(),
      textBody: `Lembrete de Prazo

Olá {{userName}},

Você tem um treinamento com prazo próximo:

Curso: {{courseName}}
Prazo: {{dueDate}}
Progresso: {{progress}}%

Acesse: {{courseUrl}}`,
      variablesSchema: [
        { name: 'userName', required: true },
        { name: 'courseName', required: true },
        { name: 'dueDate', required: true },
        { name: 'progress', required: true },
        { name: 'courseUrl', required: true },
      ],
    },
    {
      id: 'template-assignment-overdue',
      key: 'ASSIGNMENT_OVERDUE',
      subject: '⚠️ Treinamento em atraso',
      htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #dc2626;">Treinamento em Atraso</h1>
  <p>Olá <strong>{{userName}}</strong>,</p>
  <p>O prazo do seu treinamento expirou:</p>
  <div style="background-color: #fee2e2; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Curso:</strong> {{courseName}}</p>
    <p style="margin: 8px 0 0;"><strong>Prazo expirado em:</strong> {{dueDate}}</p>
    <p style="margin: 8px 0 0;"><strong>Progresso:</strong> {{progress}}%</p>
  </div>
  <p>Por favor, complete o treinamento o mais rápido possível.</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{courseUrl}}" style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Completar Agora</a>
  </p>
</body>
</html>`.trim(),
      textBody: `Treinamento em Atraso

Olá {{userName}},

O prazo do seu treinamento expirou:

Curso: {{courseName}}
Prazo expirado em: {{dueDate}}
Progresso: {{progress}}%

Por favor, complete o treinamento o mais rápido possível.

Acesse: {{courseUrl}}`,
      variablesSchema: [
        { name: 'userName', required: true },
        { name: 'courseName', required: true },
        { name: 'dueDate', required: true },
        { name: 'progress', required: true },
        { name: 'courseUrl', required: true },
      ],
    },
    {
      id: 'template-review-due',
      key: 'REVIEW_DUE',
      subject: 'Avaliação pendente de revisão',
      htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #7c3aed;">Avaliação Pendente</h1>
  <p>Olá <strong>{{reviewerName}}</strong>,</p>
  <p>Você tem uma avaliação pendente de revisão:</p>
  <div style="background-color: #ede9fe; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Aluno:</strong> {{studentName}}</p>
    <p style="margin: 8px 0 0;"><strong>Competência:</strong> {{competencyName}}</p>
    <p style="margin: 8px 0 0;"><strong>Aguardando desde:</strong> {{submittedDate}}</p>
  </div>
  <p style="text-align: center; margin: 30px 0;">
    <a href="{{reviewUrl}}" style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Revisar Avaliação</a>
  </p>
</body>
</html>`.trim(),
      textBody: `Avaliação Pendente

Olá {{reviewerName}},

Você tem uma avaliação pendente de revisão:

Aluno: {{studentName}}
Competência: {{competencyName}}
Aguardando desde: {{submittedDate}}

Acesse: {{reviewUrl}}`,
      variablesSchema: [
        { name: 'reviewerName', required: true },
        { name: 'studentName', required: true },
        { name: 'competencyName', required: true },
        { name: 'submittedDate', required: true },
        { name: 'reviewUrl', required: true },
      ],
    },
    {
      id: 'template-weekly-digest',
      key: 'WEEKLY_DIGEST',
      subject: 'Resumo Semanal - Educação Continuada',
      htmlBody: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #2563eb;">Resumo Semanal</h1>
  <p>Olá <strong>{{userName}}</strong>,</p>
  <p>Confira o resumo da semana na plataforma de Educação Continuada:</p>

  <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin: 0 0 12px; color: #374151;">📊 Métricas da Semana</h3>
    <p style="margin: 4px 0;"><strong>Usuários ativos:</strong> {{activeUsers}}</p>
    <p style="margin: 4px 0;"><strong>Aulas completadas:</strong> {{completedLessons}}</p>
    <p style="margin: 4px 0;"><strong>Quizzes realizados:</strong> {{quizzesCompleted}}</p>
    <p style="margin: 4px 0;"><strong>Certificados emitidos:</strong> {{certificatesIssued}}</p>
  </div>

  <div style="background-color: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin: 0 0 12px; color: #92400e;">⚠️ Atenção</h3>
    <p style="margin: 4px 0;"><strong>Treinamentos em atraso:</strong> {{overdueCount}}</p>
    <p style="margin: 4px 0;"><strong>Avaliações pendentes:</strong> {{pendingReviews}}</p>
  </div>

  <p style="text-align: center; margin: 30px 0;">
    <a href="{{dashboardUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Ver Dashboard Completo</a>
  </p>
</body>
</html>`.trim(),
      textBody: `Resumo Semanal - Educação Continuada

Olá {{userName}},

Confira o resumo da semana:

📊 Métricas da Semana
- Usuários ativos: {{activeUsers}}
- Aulas completadas: {{completedLessons}}
- Quizzes realizados: {{quizzesCompleted}}
- Certificados emitidos: {{certificatesIssued}}

⚠️ Atenção
- Treinamentos em atraso: {{overdueCount}}
- Avaliações pendentes: {{pendingReviews}}

Acesse o dashboard: {{dashboardUrl}}`,
      variablesSchema: [
        { name: 'userName', required: true },
        { name: 'activeUsers', required: true },
        { name: 'completedLessons', required: true },
        { name: 'quizzesCompleted', required: true },
        { name: 'certificatesIssued', required: true },
        { name: 'overdueCount', required: true },
        { name: 'pendingReviews', required: true },
        { name: 'dashboardUrl', required: true },
      ],
    },
  ];

  for (const template of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { id: template.id },
      update: {
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        variablesSchema: template.variablesSchema,
      },
      create: {
        id: template.id,
        key: template.key,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        variablesSchema: template.variablesSchema,
        createdByUserId: adminMaster.id,
      },
    });
  }
  console.log('✅ Templates de e-mail criados:', emailTemplates.length, 'templates');

  console.log('🎉 Seed concluído com sucesso!');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
