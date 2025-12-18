'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type StatusType = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED_ON_TIME' | 'COMPLETED_LATE';

interface MyAssignment {
  id: string;
  title: string;
  startAt: string;
  dueAt: string;
  status: StatusType;
  completedAt: string | null;
  isOverdue: boolean;
  course: {
    id: string;
    title: string;
  };
}

const STATUS_CONFIG: Record<StatusType, { label: string; bgColor: string; textColor: string }> = {
  PENDING: {
    label: 'Pendente',
    bgColor: 'bg-yellow-100',
    textColor: 'text-yellow-800',
  },
  IN_PROGRESS: {
    label: 'Em Andamento',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-800',
  },
  COMPLETED_ON_TIME: {
    label: 'Concluída no Prazo',
    bgColor: 'bg-green-100',
    textColor: 'text-green-800',
  },
  COMPLETED_LATE: {
    label: 'Concluída com Atraso',
    bgColor: 'bg-orange-100',
    textColor: 'text-orange-800',
  },
};

export default function MinhasAtribuicoesPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    try {
      const result = await api<MyAssignment[]>('/me/assignments');
      setAssignments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar atribuições');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR');
  }

  function getDaysRemaining(dueAt: string): number {
    const now = new Date();
    const due = new Date(dueAt);
    const diff = due.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const filteredAssignments = assignments.filter((a) => {
    if (filter === 'pending') {
      return a.status === 'PENDING' || a.status === 'IN_PROGRESS';
    }
    if (filter === 'completed') {
      return a.status === 'COMPLETED_ON_TIME' || a.status === 'COMPLETED_LATE';
    }
    return true;
  });

  const pendingCount = assignments.filter(
    (a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS'
  ).length;

  const overdueCount = assignments.filter(
    (a) =>
      (a.status === 'PENDING' || a.status === 'IN_PROGRESS') &&
      a.isOverdue
  ).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            &larr; Voltar ao início
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Minhas Atribuições</h1>
          <p className="text-gray-600">
            Acompanhe os cursos atribuídos a você
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-gray-900">{assignments.length}</div>
            <div className="text-sm text-gray-500">Total de Atribuições</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-sm text-gray-500">Pendentes</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-3xl font-bold text-red-600">{overdueCount}</div>
            <div className="text-sm text-gray-500">Atrasadas</div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(['all', 'pending', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded text-sm font-medium ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Concluídas'}
            </button>
          ))}
        </div>

        {/* Assignments list */}
        {filteredAssignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Nenhuma atribuição encontrada.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAssignments.map((item) => {
              const daysRemaining = getDaysRemaining(item.dueAt);
              const statusConfig = STATUS_CONFIG[item.status];

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-lg shadow p-6 ${
                    item.isOverdue ? 'border-l-4 border-red-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.title}
                      </h3>
                      <p className="text-gray-600">{item.course.title}</p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
                        >
                          {statusConfig.label}
                        </span>
                        {item.isOverdue && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Atrasada
                          </span>
                        )}
                      </div>

                      <div className="mt-3 text-sm text-gray-500">
                        <span>Início: {formatDate(item.startAt)}</span>
                        <span className="mx-2">•</span>
                        <span
                          className={item.isOverdue ? 'text-red-600 font-medium' : ''}
                        >
                          Prazo: {formatDate(item.dueAt)}
                          {!item.isOverdue &&
                            (item.status === 'PENDING' || item.status === 'IN_PROGRESS') && (
                              <span className="ml-1">
                                ({daysRemaining > 0 ? `${daysRemaining} dias restantes` : 'Hoje!'})
                              </span>
                            )}
                        </span>
                      </div>
                    </div>

                    <div className="ml-4">
                      <button
                        onClick={() =>
                          router.push(`/curso/${item.course.id}`)
                        }
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                      >
                        {item.status === 'PENDING'
                          ? 'Iniciar'
                          : item.status === 'IN_PROGRESS'
                          ? 'Continuar'
                          : 'Revisar'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
