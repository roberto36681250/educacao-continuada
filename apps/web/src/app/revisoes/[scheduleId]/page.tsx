'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'CASE';
  options: Option[];
}

interface ReviewData {
  scheduleId: string;
  competencyName: string;
  competencyDescription: string | null;
  questions: Question[];
}

interface SubmitResult {
  score: number;
  passed: boolean;
  newState: string;
  correctCount: number;
  totalQuestions: number;
}

export default function RevisaoPage() {
  const router = useRouter();
  const params = useParams();
  const scheduleId = params.scheduleId as string;

  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startReview();
  }, [scheduleId]);

  async function startReview() {
    setLoading(true);
    setError(null);
    try {
      const data = await api<ReviewData>(`/reviews/${scheduleId}/start`, {
        method: 'POST',
      });
      setReviewData(data);
      // Initialize answers
      const initialAnswers: Record<string, string[]> = {};
      data.questions.forEach((q) => {
        initialAnswers[q.id] = [];
      });
      setAnswers(initialAnswers);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      setError(err.message || 'Erro ao iniciar revisao');
    } finally {
      setLoading(false);
    }
  }

  function handleOptionChange(questionId: string, optionId: string, isMultiple: boolean) {
    setAnswers((prev) => {
      if (isMultiple) {
        const current = prev[questionId] || [];
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
        }
        return { ...prev, [questionId]: [...current, optionId] };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  }

  async function handleSubmit() {
    if (!reviewData) return;

    // Validate all questions answered
    const unanswered = reviewData.questions.filter(
      (q) => !answers[q.id] || answers[q.id].length === 0
    );
    if (unanswered.length > 0) {
      alert(`Responda todas as questoes antes de enviar. Faltam ${unanswered.length} questoes.`);
      return;
    }

    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([questionId, selectedOptionIds]) => ({
        questionId,
        selectedOptionIds,
      }));

      const data = await api<SubmitResult>(`/reviews/${scheduleId}/submit`, {
        method: 'POST',
        body: { answers: formattedAnswers },
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar revisao');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando revisao...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <Link
            href="/revisoes"
            className="text-blue-600 hover:underline"
          >
            Voltar para Revisoes
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 text-center max-w-md">
          <div
            className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center text-3xl mb-4 ${
              result.passed ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            {result.passed ? '✓' : '✗'}
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {result.passed ? 'Revisao Concluida!' : 'Tente Novamente'}
          </h2>
          <p className="text-gray-600 mb-4">
            Voce acertou {result.correctCount} de {result.totalQuestions} questoes
          </p>
          <div className="text-4xl font-bold mb-4">
            <span
              className={
                result.score >= 80
                  ? 'text-green-600'
                  : result.score >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }
            >
              {result.score}%
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Seu estado de competencia:{' '}
            <span
              className={`font-medium ${
                result.newState === 'GREEN'
                  ? 'text-green-600'
                  : result.newState === 'YELLOW'
                  ? 'text-yellow-600'
                  : result.newState === 'ORANGE'
                  ? 'text-orange-600'
                  : 'text-red-600'
              }`}
            >
              {result.newState === 'GREEN'
                ? 'Verde (Otimo)'
                : result.newState === 'YELLOW'
                ? 'Amarelo (Bom)'
                : result.newState === 'ORANGE'
                ? 'Laranja (Atencao)'
                : 'Vermelho (Critico)'}
            </span>
          </p>
          <Link
            href="/revisoes"
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 inline-block"
          >
            Voltar para Revisoes
          </Link>
        </div>
      </div>
    );
  }

  if (!reviewData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Revisao de Competencia</h1>
          <p className="text-gray-600">{reviewData.competencyName}</p>
          {reviewData.competencyDescription && (
            <p className="text-sm text-gray-500 mt-1">
              {reviewData.competencyDescription}
            </p>
          )}
        </div>

        <div className="space-y-6">
          {reviewData.questions.map((question, index) => {
            const isMultiple = question.type === 'MULTIPLE_SELECT';

            return (
              <div key={question.id} className="bg-white rounded-lg shadow p-6">
                <p className="font-medium mb-4">
                  {index + 1}. {question.text}
                </p>
                {isMultiple && (
                  <p className="text-sm text-gray-500 mb-3">
                    (Selecione todas as opcoes corretas)
                  </p>
                )}
                <div className="space-y-2">
                  {question.options.map((option) => {
                    const isSelected = answers[question.id]?.includes(option.id);

                    return (
                      <label
                        key={option.id}
                        className={`flex items-center p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <input
                          type={isMultiple ? 'checkbox' : 'radio'}
                          name={`question-${question.id}`}
                          checked={isSelected}
                          onChange={() =>
                            handleOptionChange(question.id, option.id, isMultiple)
                          }
                          className="mr-3"
                        />
                        <span>{option.text}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <Link href="/revisoes" className="text-gray-600 hover:underline">
            Cancelar
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Enviando...' : 'Enviar Revisao'}
          </button>
        </div>
      </div>
    </div>
  );
}
