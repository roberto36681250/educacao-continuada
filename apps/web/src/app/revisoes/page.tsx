'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Review {
  id: string;
  competencyId: string;
  dueAt: string;
  status: 'DUE' | 'DONE' | 'OVERDUE';
  score: number | null;
  doneAt: string | null;
  competency: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface CompetencyState {
  id: string;
  competencyId: string;
  state: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  lastReviewAt: string | null;
  nextDueAt: string | null;
  competency: {
    name: string;
  };
}

const statusLabels: Record<string, string> = {
  DUE: 'Pendente',
  DONE: 'Concluida',
  OVERDUE: 'Atrasada',
};

const statusColors: Record<string, string> = {
  DUE: 'bg-yellow-100 text-yellow-800',
  DONE: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
};

const stateColors: Record<string, string> = {
  GREEN: 'bg-green-500',
  YELLOW: 'bg-yellow-500',
  ORANGE: 'bg-orange-500',
  RED: 'bg-red-500',
};

export default function RevisoesPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [competencyStates, setCompetencyStates] = useState<CompetencyState[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'states'>('pending');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [reviewsData, statesData] = await Promise.all([
        api<Review[]>('/me/reviews'),
        api<CompetencyState[]>('/me/competencies'),
      ]);
      setReviews(reviewsData);
      setCompetencyStates(statesData);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  function getDaysUntil(dateStr: string): number {
    const now = new Date();
    const target = new Date(dateStr);
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const pendingReviews = reviews.filter((r) => r.status !== 'DONE');
  const doneReviews = reviews.filter((r) => r.status === 'DONE');
  const overdueCount = reviews.filter((r) => r.status === 'OVERDUE').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Minhas Revisoes</h1>
            <p className="text-gray-600">
              {pendingReviews.length} pendentes
              {overdueCount > 0 && (
                <span className="text-red-600 ml-2">({overdueCount} atrasadas)</span>
              )}
            </p>
          </div>
          <Link
            href="/"
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Voltar
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 border-b-2 ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Revisoes Pendentes ({pendingReviews.length})
          </button>
          <button
            onClick={() => setActiveTab('states')}
            className={`px-4 py-2 border-b-2 ${
              activeTab === 'states'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Minhas Competencias ({competencyStates.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Carregando...</p>
          </div>
        ) : activeTab === 'pending' ? (
          <>
            {pendingReviews.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">Nenhuma revisao pendente</p>
                <p className="text-sm text-gray-400 mt-2">
                  Continue seus estudos para ganhar competencias!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReviews.map((review) => {
                  const daysUntil = getDaysUntil(review.dueAt);
                  const isOverdue = review.status === 'OVERDUE';

                  return (
                    <div
                      key={review.id}
                      className={`bg-white rounded-lg shadow p-4 ${
                        isOverdue ? 'border-l-4 border-red-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">
                            {review.competency.name}
                          </h3>
                          {review.competency.description && (
                            <p className="text-sm text-gray-600">
                              {review.competency.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                statusColors[review.status]
                              }`}
                            >
                              {statusLabels[review.status]}
                            </span>
                            <span
                              className={`text-sm ${
                                isOverdue ? 'text-red-600' : 'text-gray-500'
                              }`}
                            >
                              {isOverdue
                                ? `Atrasada desde ${formatDate(review.dueAt)}`
                                : daysUntil === 0
                                ? 'Hoje'
                                : daysUntil === 1
                                ? 'Amanha'
                                : `Em ${daysUntil} dias (${formatDate(review.dueAt)})`}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => router.push(`/revisoes/${review.id}`)}
                          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                        >
                          Fazer Revisao
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {doneReviews.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-4 text-gray-700">
                  Revisoes Concluidas ({doneReviews.length})
                </h2>
                <div className="space-y-2">
                  {doneReviews.slice(0, 5).map((review) => (
                    <div
                      key={review.id}
                      className="bg-white rounded-lg shadow p-3 flex justify-between items-center"
                    >
                      <div>
                        <p className="font-medium">{review.competency.name}</p>
                        <p className="text-sm text-gray-500">
                          Concluida em {formatDate(review.doneAt!)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${
                          review.score! >= 80
                            ? 'bg-green-100 text-green-800'
                            : review.score! >= 60
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {review.score}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {competencyStates.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-500">
                  Voce ainda nao possui competencias registradas
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Complete aulas com competencias associadas para comecar!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {competencyStates.map((state) => (
                  <div
                    key={state.id}
                    className="bg-white rounded-lg shadow p-4 flex items-center gap-4"
                  >
                    <div
                      className={`w-4 h-4 rounded-full ${stateColors[state.state]}`}
                      title={state.state}
                    />
                    <div className="flex-1">
                      <h3 className="font-medium">{state.competency.name}</h3>
                      <p className="text-sm text-gray-500">
                        {state.lastReviewAt
                          ? `Ultima revisao: ${formatDate(state.lastReviewAt)}`
                          : 'Sem revisao recente'}
                        {state.nextDueAt && (
                          <span className="ml-2">
                            | Proxima: {formatDate(state.nextDueAt)}
                          </span>
                        )}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        state.state === 'GREEN'
                          ? 'bg-green-100 text-green-800'
                          : state.state === 'YELLOW'
                          ? 'bg-yellow-100 text-yellow-800'
                          : state.state === 'ORANGE'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {state.state === 'GREEN'
                        ? 'Otimo'
                        : state.state === 'YELLOW'
                        ? 'Bom'
                        : state.state === 'ORANGE'
                        ? 'Atencao'
                        : 'Critico'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
