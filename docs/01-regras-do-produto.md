# Regras do Produto - Educação Continuada

## 1. Estrutura Organizacional

### Instituto
- Existe apenas **1 Instituto** no sistema
- Nome fixo: "Educação Continuada"
- Todos os hospitais, usuários e cursos pertencem ao Instituto

### Hospitais e Unidades
- Um Instituto possui **N Hospitais**
- Um Hospital possui **N Unidades** (UTIs, unidades assistenciais, comissões)
- Exemplos de unidades: UTI Adulto A, UTI Adulto B, Comissão Sepse

### Usuários
- Profissão é **fixa** no cadastro do usuário (string livre, ex: "Médico", "Enfermeiro")
- Registro profissional opcional (CRM, COREN, CREFITO, etc.)
- Usuário sempre vinculado ao Instituto

### Lotação (UserUnitAssignment)
- Lotação é **móvel** com histórico
- Campos: userId, unitId, startAt, endAt (nullable), isPrimary
- Um usuário pode ter múltiplas lotações simultâneas
- `isPrimary` indica a lotação principal

---

## 2. Conteúdo e Aprendizado

### Estrutura de Cursos
```
Curso
└── Módulos (N, ordem editável)
    └── Aulas (N, ordem editável)
        └── Quiz (1 por aula)
            └── Questões (N)
```

### Status de Conteúdo
1. `DRAFT` - Rascunho
2. `REVIEWED` - Revisado
3. `APPROVED` - Aprovado
4. `PUBLISHED` - Publicado
5. `ARCHIVED` - Arquivado

### Vídeos
- Hospedados no **YouTube como NÃO LISTADOS**
- Armazenamos: `youtubeVideoId`, `durationSeconds`
- `minWatchPercent` padrão: **90%**

### Validação de Visualização
- Para liberar o quiz, usuário deve assistir **90%** do tempo da aula
- Validação por "tempo em tela" (mecanismo a implementar)
- Tracking via `VideoProgress`: watchedSeconds, watchedPct, completed

---

## 3. Quiz e Avaliação

### Regras de Progressão
- **Nota mínima**: 70%
- **3 tentativas** por ciclo
- Após 3 falhas: **bloqueia quiz** e exige reassistir a aula
- Após reassistir: libera novo ciclo de 3 tentativas

### Status de Tentativa (QuizAttemptStatus)
- `IN_PROGRESS` - Em andamento
- `PASSED` - Aprovado (score >= 70)
- `FAILED` - Reprovado (ainda tem tentativas no ciclo)
- `REQUIRES_REWATCH` - Bloqueado, precisa reassistir

### Caso Clínico
- Questão com `isCase = true`
- Pode exigir justificativa: `justificationRequired = true`
- Justificativa armazenada em `QuestionAnswer.justification`

---

## 4. Ranking

### Regra de Ranking por Profissão no Instituto

O ranking é calculado **por profissão** dentro do Instituto, usando score ajustado para evitar distorções com amostras pequenas.

#### Fórmulas

```
taxa = concluintes_no_prazo / ativos_no_periodo
fator = min(1, N / k)
score = taxa * fator
```

Onde:
- `concluintes_no_prazo`: usuários que concluíram dentro do prazo
- `ativos_no_periodo`: usuários ativos no período de avaliação
- `N`: quantidade de usuários ativos na profissão
- `k`: constante de estabilização = **20**
- `fator`: penaliza amostras pequenas (se N < 20, o score é reduzido proporcionalmente)

#### Exemplo

| Profissão | Ativos (N) | Concluintes | Taxa | Fator (k=20) | Score |
|-----------|------------|-------------|------|--------------|-------|
| Médico    | 50         | 45          | 90%  | 1.0          | 90%   |
| Enfermeiro| 30         | 27          | 90%  | 1.0          | 90%   |
| Fisio     | 10         | 9           | 90%  | 0.5          | 45%   |

O Fisioterapeuta com 10 ativos e 90% de taxa recebe score ajustado de 45%, pois a amostra é pequena e menos confiável estatisticamente.

#### Importante
- **Proibido ranking individual** de usuários
- Ranking é sempre **por equipe/profissão**

---

## 5. Certificados

- Certificado digital incluso ao concluir curso
- Assinatura: "Educação Continuada"
- Formato: PDF com QR code
- Endpoint público de verificação de autenticidade

---

## 6. Suporte

- Tickets vinculados opcionalmente a: curso, módulo, aula, tentativa de quiz
- Status: OPEN, IN_PROGRESS, RESOLVED, CLOSED
- FAQ simples por curso no MVP

---

## 7. Auditoria (AuditLog)

Eventos registrados:
- LOGIN
- LESSON_STARTED
- LESSON_COMPLETED
- QUIZ_ATTEMPT_STARTED
- QUIZ_ATTEMPT_FINISHED
- QUIZ_BLOCKED (3 falhas)
- QUIZ_UNBLOCKED (após reassistir)
- CERTIFICATE_ISSUED
- TICKET_CREATED
- TICKET_REPLIED
- CONTENT_PUBLISHED

---

## 8. Autenticação (a implementar)

- Cadastro **somente via link de convite**
- Campos obrigatórios: nome, e-mail, CPF, telefone, profissão, registro profissional
- E-mail e CPF únicos
- Usuário nasce vinculado ao Instituto
