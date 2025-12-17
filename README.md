# Educação Continuada

Plataforma web de Educação Continuada para equipes hospitalares.

## Visão Geral

Sistema fechado para hospitais, com foco inicial em UTI multiprofissional. Permite gestão de cursos modulares, quizzes com regras de progressão, trilhas obrigatórias por função e certificados digitais.

## Stack Técnica

- **Monorepo**: pnpm workspaces
- **Web**: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- **API**: NestJS + Prisma
- **Banco**: Supabase Postgres

## Estrutura do Projeto

```
educacao-continuada/
├── apps/
│   ├── web/          # Frontend Next.js
│   └── api/          # Backend NestJS
├── packages/
│   └── shared/       # Tipos e utilitários compartilhados
└── docs/             # Documentação do projeto
```

## Requisitos

- Node.js >= 18
- pnpm >= 8

## Instalação

```bash
pnpm install
```

## Desenvolvimento

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

## Documentação

- [Progresso do Desenvolvimento](docs/progresso.md)
- [Arquitetura](docs/arquitetura.md)
