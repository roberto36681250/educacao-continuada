# Progresso do Desenvolvimento

## Bloco 0 - Setup Inicial
**Status**: Concluído

### O que foi feito
- Repositório Git inicializado
- README.md criado com visão geral do projeto
- Estrutura de documentação criada (docs/arquitetura.md, docs/progresso.md)
- .gitignore configurado

### Como testar
- Verificar existência do `.git/`
- Verificar arquivos de documentação

---

## Bloco 1 - Bootstrap Monorepo
**Status**: Concluído

### O que foi feito
- Monorepo configurado com pnpm workspaces
- apps/web: Next.js 14 + TypeScript + Tailwind CSS
- apps/api: NestJS 10 com endpoint GET /health
- packages/shared: Pacote para tipos e utilitários compartilhados

### Como testar
```bash
pnpm install
pnpm dev
# Web: http://localhost:3000
# API: http://localhost:3001/health -> { "status": "ok" }
```

### Testes manuais executados
- [x] `pnpm install` - Instalou 813 pacotes
- [x] `pnpm dev` - Web e API iniciaram sem erros
- [x] http://localhost:3000 - Página inicial renderizada corretamente
- [x] http://localhost:3001/health - Retornou `{"status":"ok"}`

---

## Bloco 2 - Supabase + Prisma + Seed
**Status**: Concluído

### O que foi feito
- Prisma 7 instalado e configurado em apps/api
- Conexão com Supabase Postgres via Session Pooler (IPv4 compatível)
- Schema completo criado com todas entidades:
  - **Organizacional**: Institute, Hospital, Unit, User, UserUnitAssignment
  - **Conteúdo**: Course, Module, Lesson, VideoProgress
  - **Quiz**: Quiz, Question, Option, QuizAttempt, QuestionAnswer
  - **Competências**: Competency, UserCompetency
  - **Suporte**: Ticket
  - **Auditoria**: AuditLog
- Seed executado com dados iniciais
- Documentação das regras do produto criada

### Dados criados no seed
- 1 Instituto: "Educação Continuada"
- 2 Hospitais: Hospital Central, Hospital Norte
- 4 Unidades: UTI Adulto A, UTI Adulto B, Comissão Sepse, UTI Norte
- 4 Usuários:
  - Admin Master (admin@educacaocontinuada.com.br)
  - Dr. João Silva (Médico)
  - Maria Santos (Enfermeiro)
  - Carlos Oliveira (Fisioterapeuta)
- 4 Lotações com histórico

### Como testar
```bash
cd apps/api

# Sincronizar schema com banco (se necessário)
npx prisma db push

# Rodar seed (popula dados iniciais)
npx prisma db seed

# Abrir Prisma Studio (visualizar dados)
npx prisma studio
```

### Arquivos importantes
- `apps/api/.env` - DATABASE_URL do Supabase
- `apps/api/prisma/schema.prisma` - Schema do banco
- `apps/api/prisma/seed.ts` - Script de seed
- `apps/api/prisma.config.ts` - Configuração do Prisma 7
- `docs/01-regras-do-produto.md` - Regras de negócio documentadas

### Testes manuais executados
- [x] `npx prisma db push` - Schema sincronizado com Supabase
- [x] `npx prisma db seed` - Seed executado com sucesso
- [x] Dados visíveis no painel do Supabase
