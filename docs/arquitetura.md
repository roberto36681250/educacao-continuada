# Arquitetura

## Estrutura Organizacional

```
Instituto (único)
└── Hospitais/Unidades
    └── Equipes
        └── Funções
            └── Usuários
```

## Modelo de Conteúdo

```
Curso
└── Módulos (N)
    └── Aulas (N)
        └── Quiz
            └── Questões
```

## Status de Conteúdo

1. `draft` - Rascunho
2. `reviewed` - Revisado
3. `approved` - Aprovado
4. `published` - Publicado
5. `archived` - Arquivado

## Regras de Progressão

- Nota mínima: 70%
- 3 tentativas por ciclo de quiz
- Após 3 falhas: bloqueia quiz, exige reassistir aula
- Validação de 90% do tempo de aula para liberar quiz

## Autenticação

- Cadastro apenas por convite
- Campos obrigatórios: nome, e-mail, CPF, telefone, profissão, registro profissional
- E-mail e CPF únicos
- Usuário sempre vinculado ao Instituto
