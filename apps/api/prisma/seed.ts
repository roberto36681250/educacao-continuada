import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '@prisma/client';

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

  // 4. Criar usuário ADMIN_MASTER
  const adminMaster = await prisma.user.upsert({
    where: { email: 'admin@educacaocontinuada.com.br' },
    update: {},
    create: {
      id: 'user-admin-master',
      email: 'admin@educacaocontinuada.com.br',
      name: 'Administrador Master',
      cpf: '00000000000',
      phone: '11999999999',
      profession: 'Administrador',
      professionalRegister: null,
      role: UserRole.ADMIN_MASTER,
      instituteId: institute.id,
    },
  });
  console.log('✅ Admin Master criado:', adminMaster.email);

  // 5. Criar usuários de exemplo com profissões diferentes
  const medicoR1 = await prisma.user.upsert({
    where: { email: 'medico.r1@exemplo.com' },
    update: {},
    create: {
      id: 'user-medico-r1',
      email: 'medico.r1@exemplo.com',
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
    update: {},
    create: {
      id: 'user-enfermeira',
      email: 'enfermeira@exemplo.com',
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
    update: {},
    create: {
      id: 'user-fisioterapeuta',
      email: 'fisio@exemplo.com',
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
