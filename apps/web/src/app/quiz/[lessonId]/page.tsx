'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface QuizState {
  hasQuiz: boolean;
  quizId: string | null;
  minScore: number;
  completedVideo: boolean;
  approved: boolean;
  approvalScore: number | null;
  isBlocked: boolean;
  currentCycleNumber: number;
  attemptsUsedInCycle: number;
  maxAttempts: number;
  inProgressAttemptId: string | null;
  lastAttempts: {
    id: string;
    attemptNumber: number;
    score: number | null;
    status: string;
    finishedAt: string | null;
  }[];
}

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'CASE';
  justificationRequired: boolean;
  options: Option[];
}

interface SubmitResult {
  attemptId: string;
  score: number;
  minScore: number;
  passed: boolean;
  status: string;
  correctCount: number;
  totalQuestions: number;
  message: string;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizState, setQuizState] = useState<QuizState | null>(null);

  // Estados do quiz em andamento
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, { optionIds: string[]; justification: string }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const handleSubmitTicket = async () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;
    setSubmittingTicket(true);
    try {
      await api('/tickets', {
        method: 'POST',
        body: {
          subject: ticketSubject,
          message: ticketMessage,
          category: 'QUIZ',
          lessonId,
          quizAttemptId: attemptId || undefined,
        },
      });
      setShowTicketModal(false);
      setTicketSubject('');
      setTicketMessage('');
      alert('Dúvida enviada com sucesso! Acompanhe em Suporte.');
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar dúvida');
    } finally {
      setSubmittingTicket(false);
    }
  };

  useEffect(() => {
    loadQuizState();
  }, [lessonId]);

  async function loadQuizState() {
    try {
      const state = await api<QuizState>(`/lessons/${lessonId}/quiz-state`);
      setQuizState(state);

      // Se já tem tentativa em progresso, carregar questões
      if (state.inProgressAttemptId) {
        await startOrResumeQuiz();
      }
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      setError(err.message || 'Erro ao carregar estado do quiz');
    } finally {
      setLoading(false);
    }
  }

  async function startOrResumeQuiz() {
    setError('');
    try {
      const res = await api<{ attemptId: string; questions: Question[] }>(
        `/lessons/${lessonId}/quiz/start`,
        { method: 'POST' }
      );
      setAttemptId(res.attemptId);
      setQuestions(res.questions);

      // Inicializar respostas vazias
      const initialAnswers: Record<string, { optionIds: string[]; justification: string }> = {};
      res.questions.forEach((q: Question) => {
        initialAnswers[q.id] = { optionIds: [], justification: '' };
      });
      setAnswers(initialAnswers);
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar quiz');
    }
  }

  function handleOptionChange(questionId: string, optionId: string, questionType: Question['type']) {
    setAnswers((prev) => {
      const current = prev[questionId] || { optionIds: [], justification: '' };

      if (questionType === 'MULTIPLE_SELECT') {
        // Toggle: adiciona ou remove
        const newIds = current.optionIds.includes(optionId)
          ? current.optionIds.filter((id) => id !== optionId)
          : [...current.optionIds, optionId];
        return { ...prev, [questionId]: { ...current, optionIds: newIds } };
      } else {
        // Single choice: substitui
        return { ...prev, [questionId]: { ...current, optionIds: [optionId] } };
      }
    });
  }

  function handleJustificationChange(questionId: string, text: string) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], justification: text },
    }));
  }

  async function handleSubmit() {
    if (!attemptId) return;

    // Validar que todas as questões foram respondidas
    const unanswered = questions.filter((q) => {
      const answer = answers[q.id];
      return !answer || answer.optionIds.length === 0;
    });

    if (unanswered.length > 0) {
      setError(`Por favor, responda todas as questões. Faltam ${unanswered.length} questão(ões).`);
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, data]) => ({
          questionId,
          selectedOptionIds: data.optionIds,
          justificationText: data.justification || undefined,
        })),
      };

      const res = await api<SubmitResult>(`/quiz/attempts/${attemptId}/submit`, {
        method: 'POST',
        body: payload,
      });
      setResult(res);

      // Recarregar estado
      const newState = await api<QuizState>(`/lessons/${lessonId}/quiz-state`);
      setQuizState(newState);
    } catch (err: any) {
      setError(err.message || 'Erro ao submeter quiz');
    } finally {
      setSubmitting(false);
    }
  }

  function resetQuiz() {
    setAttemptId(null);
    setQuestions([]);
    setAnswers({});
    setResult(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  // Se já está aprovado
  if (quizState?.approved) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h1 className="text-2xl font-bold text-green-600 mb-2">Parabéns!</h1>
            <p className="text-gray-600 mb-4">
              Você já foi aprovado nesta aula com nota <strong>{quizState.approvalScore}</strong>.
            </p>
            <button
              onClick={() => router.push(`/aula/${lessonId}`)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Voltar para a aula
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se não tem quiz configurado
  if (!quizState?.hasQuiz) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h1 className="text-xl font-bold mb-4">Quiz não disponível</h1>
            <p className="text-gray-600 mb-4">
              Esta aula ainda não possui um quiz configurado.
            </p>
            <button
              onClick={() => router.push(`/aula/${lessonId}`)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Voltar para a aula
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se não completou o vídeo
  if (!quizState?.completedVideo) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📺</div>
            <h1 className="text-xl font-bold mb-4">Complete o vídeo primeiro</h1>
            <p className="text-gray-600 mb-4">
              Você precisa assistir pelo menos 90% do vídeo para liberar o quiz.
            </p>
            <button
              onClick={() => router.push(`/aula/${lessonId}`)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Voltar para a aula
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se está bloqueado (REQUIRES_REWATCH)
  if (quizState?.isBlocked) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-xl font-bold text-red-600 mb-4">Quiz Bloqueado</h1>
            <p className="text-gray-600 mb-4">
              Você esgotou as 3 tentativas neste ciclo.
              <br />
              <strong>Reassista a aula completa</strong> para liberar um novo ciclo de tentativas.
            </p>
            <div className="bg-gray-50 p-4 rounded mb-4">
              <p className="text-sm text-gray-600">
                Ciclo atual: <strong>{quizState.currentCycleNumber}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Tentativas usadas: <strong>{quizState.attemptsUsedInCycle}/3</strong>
              </p>
            </div>
            <button
              onClick={() => router.push(`/aula/${lessonId}`)}
              className="bg-orange-600 text-white px-6 py-2 rounded hover:bg-orange-700"
            >
              Reassistir Aula
            </button>
          </div>

          {/* Histórico de tentativas */}
          {quizState.lastAttempts.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow p-6">
              <h2 className="font-semibold mb-4">Histórico de Tentativas (Ciclo {quizState.currentCycleNumber})</h2>
              <div className="space-y-2">
                {quizState.lastAttempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded"
                  >
                    <span>Tentativa {attempt.attemptNumber}</span>
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        attempt.status === 'PASSED'
                          ? 'bg-green-100 text-green-800'
                          : attempt.status === 'REQUIRES_REWATCH'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {attempt.score !== null ? `${attempt.score}%` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Mostrar resultado após submissão
  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">{result.passed ? '🎉' : '😔'}</div>
            <h1
              className={`text-2xl font-bold mb-2 ${
                result.passed ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {result.passed ? 'Aprovado!' : 'Não foi desta vez'}
            </h1>
            <p className="text-4xl font-bold mb-4">{result.score}%</p>
            <p className="text-gray-600 mb-2">
              Você acertou {result.correctCount} de {result.totalQuestions} questões.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Nota mínima: {result.minScore}%
            </p>
            <p className="mb-6">{result.message}</p>

            {result.passed ? (
              <button
                onClick={() => router.push(`/aula/${lessonId}`)}
                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
              >
                Continuar
              </button>
            ) : result.status === 'REQUIRES_REWATCH' ? (
              <button
                onClick={() => router.push(`/aula/${lessonId}`)}
                className="bg-orange-600 text-white px-6 py-2 rounded hover:bg-orange-700"
              >
                Reassistir Aula
              </button>
            ) : (
              <div className="space-x-4">
                <button
                  onClick={() => {
                    resetQuiz();
                    loadQuizState();
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                >
                  Tentar Novamente
                </button>
                <button
                  onClick={() => router.push(`/aula/${lessonId}`)}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded hover:bg-gray-400"
                >
                  Voltar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Se está fazendo o quiz
  if (attemptId && questions.length > 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Quiz</h1>
              <span className="text-gray-600">
                Tentativa {quizState!.attemptsUsedInCycle + 1} de {quizState!.maxAttempts}
              </span>
            </div>
            <p className="text-gray-500 text-sm">Nota mínima: {quizState!.minScore}%</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-6">
            {questions.map((question, qIndex) => (
              <div key={question.id} className="bg-white rounded-lg shadow p-6">
                <div className="mb-4">
                  <span className="text-sm text-gray-500">Questão {qIndex + 1}</span>
                  <p className="font-medium text-lg">{question.text}</p>
                  {question.type === 'MULTIPLE_SELECT' && (
                    <p className="text-sm text-blue-600 mt-1">
                      Selecione todas as opções corretas
                    </p>
                  )}
                  {question.type === 'CASE' && (
                    <span className="inline-block mt-1 text-xs px-2 py-1 bg-orange-100 text-orange-800 rounded">
                      Caso Clínico
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {question.options.map((option) => {
                    const isSelected = answers[question.id]?.optionIds.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex items-center p-3 rounded border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type={question.type === 'MULTIPLE_SELECT' ? 'checkbox' : 'radio'}
                          name={`question-${question.id}`}
                          checked={isSelected}
                          onChange={() =>
                            handleOptionChange(question.id, option.id, question.type)
                          }
                          className="h-4 w-4 mr-3"
                        />
                        <span>{option.text}</span>
                      </label>
                    );
                  })}
                </div>

                {question.justificationRequired && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Justificativa (obrigatória)
                    </label>
                    <textarea
                      value={answers[question.id]?.justification || ''}
                      onChange={(e) => handleJustificationChange(question.id, e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                      rows={3}
                      placeholder="Explique sua resposta..."
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/aula/${lessonId}`)}
                className="text-gray-600 hover:underline"
              >
                Cancelar
              </button>
              <button
                onClick={() => setShowTicketModal(true)}
                className="text-orange-600 hover:text-orange-700 flex items-center gap-1"
              >
                <span>❓</span> Dúvida
              </button>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
            >
              {submitting ? 'Enviando...' : 'Enviar Respostas'}
            </button>
          </div>
        </div>

        {/* Modal de Dúvida */}
        {showTicketModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h2 className="text-xl font-bold mb-4">Enviar Dúvida sobre o Quiz</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assunto
                  </label>
                  <input
                    type="text"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Resumo da sua dúvida"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mensagem
                  </label>
                  <textarea
                    value={ticketMessage}
                    onChange={(e) => setTicketMessage(e.target.value)}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={4}
                    placeholder="Descreva sua dúvida em detalhes..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitTicket}
                  disabled={submittingTicket || !ticketSubject.trim() || !ticketMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingTicket ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Tela inicial - antes de começar
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">📝</div>
          <h1 className="text-2xl font-bold mb-4">Quiz da Aula</h1>

          <div className="bg-gray-50 p-4 rounded mb-6 text-left">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Nota mínima:</span>
                <span className="ml-2 font-medium">{quizState!.minScore}%</span>
              </div>
              <div>
                <span className="text-gray-500">Tentativas:</span>
                <span className="ml-2 font-medium">
                  {quizState!.attemptsUsedInCycle}/{quizState!.maxAttempts}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Ciclo:</span>
                <span className="ml-2 font-medium">{quizState!.currentCycleNumber}</span>
              </div>
              <div>
                <span className="text-gray-500">Restantes:</span>
                <span className="ml-2 font-medium">
                  {quizState!.maxAttempts - quizState!.attemptsUsedInCycle}
                </span>
              </div>
            </div>
          </div>

          {quizState!.attemptsUsedInCycle > 0 && (
            <div className="mb-6 bg-yellow-50 p-4 rounded">
              <p className="text-yellow-800 text-sm">
                Você já fez {quizState!.attemptsUsedInCycle} tentativa(s) neste ciclo.
                Ainda restam {quizState!.maxAttempts - quizState!.attemptsUsedInCycle} tentativa(s).
              </p>
            </div>
          )}

          <button
            onClick={startOrResumeQuiz}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-medium"
          >
            {quizState!.inProgressAttemptId ? 'Continuar Quiz' : 'Iniciar Quiz'}
          </button>

          <button
            onClick={() => router.push(`/aula/${lessonId}`)}
            className="block mt-4 text-gray-600 hover:underline mx-auto"
          >
            Voltar para a aula
          </button>
        </div>

        {/* Histórico de tentativas */}
        {quizState!.lastAttempts.length > 0 && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold mb-4">Tentativas Anteriores</h2>
            <div className="space-y-2">
              {quizState!.lastAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded"
                >
                  <span>Tentativa {attempt.attemptNumber}</span>
                  <span
                    className={`px-2 py-1 rounded text-sm ${
                      attempt.status === 'PASSED'
                        ? 'bg-green-100 text-green-800'
                        : attempt.status === 'REQUIRES_REWATCH'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {attempt.score !== null ? `${attempt.score}%` : 'Em andamento'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
