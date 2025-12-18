'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  profession?: string;
}

interface PendingAssignment {
  id: string;
  title: string;
  status: 'PENDING' | 'IN_PROGRESS';
  dueAt: string;
  isOverdue: boolean;
  course: {
    id: string;
    title: string;
  };
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const userData = await api<User>('/auth/me');
      setUser(userData);

      // Load pending assignments for non-admin users
      if (userData.role !== 'ADMIN_MASTER') {
        try {
          const assignments = await api<PendingAssignment[]>('/me/assignments');
          const pending = assignments.filter(
            (a) => a.status === 'PENDING' || a.status === 'IN_PROGRESS'
          );
          setPendingAssignments(pending);
        } catch {
          // Ignore errors loading assignments
        }
      }
    } catch {
      localStorage.removeItem('token');
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

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <p className="text-gray-500">Carregando...</p>
      </main>
    );
  }

  // Not logged in - show landing page
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-4xl font-bold text-center">Educação Continuada</h1>
        <p className="mt-4 text-lg text-gray-600">
          Plataforma de Educação Continuada para equipes hospitalares
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Entrar
        </button>
      </main>
    );
  }

  // Logged in - show dashboard
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Olá, {user.name.split(' ')[0]}!
          </h1>
          <p className="text-gray-600">Bem-vindo à plataforma de Educação Continuada</p>
        </div>

        {/* Pending assignments alert */}
        {pendingAssignments.length > 0 && (
          <div className="mb-8">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-yellow-800">
                    Você tem {pendingAssignments.length} atribuição(ões) pendente(s)
                  </h2>
                  <p className="text-yellow-700 text-sm">
                    Complete seus cursos dentro do prazo para manter um bom desempenho
                  </p>
                </div>
                <button
                  onClick={() => router.push('/minhas-atribuicoes')}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                >
                  Ver todas
                </button>
              </div>
            </div>

            {/* List of urgent assignments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingAssignments.slice(0, 4).map((item) => {
                const daysRemaining = getDaysRemaining(item.dueAt);

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-lg shadow p-4 ${
                      item.isOverdue ? 'border-l-4 border-red-500' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {item.course.title}
                        </p>
                        <p
                          className={`text-sm mt-1 ${
                            item.isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
                          }`}
                        >
                          {item.isOverdue
                            ? `Atrasado (${formatDate(item.dueAt)})`
                            : daysRemaining <= 3
                            ? `${daysRemaining} dia(s) restante(s)`
                            : `Prazo: ${formatDate(item.dueAt)}`}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          router.push(`/curso/${item.course.id}`)
                        }
                        className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        {item.status === 'PENDING' ? 'Iniciar' : 'Continuar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick access cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/cursos')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Meus Cursos</h3>
            <p className="text-gray-600 text-sm mt-1">
              Acesse os cursos disponíveis para você
            </p>
          </button>

          <button
            onClick={() => router.push('/minhas-atribuicoes')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Minhas Atribuições</h3>
            <p className="text-gray-600 text-sm mt-1">
              Veja os cursos atribuídos a você com prazo
            </p>
          </button>

          <button
            onClick={() => router.push('/me')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Meu Perfil</h3>
            <p className="text-gray-600 text-sm mt-1">
              Veja suas informações e lotação
            </p>
          </button>
        </div>

        {/* Role-specific actions */}
        {(user.role === 'ADMIN_MASTER' || user.role === 'ADMIN') && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Área Administrativa
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/admin')}
                className="bg-indigo-50 rounded-lg p-4 text-left hover:bg-indigo-100 transition-colors"
              >
                <h3 className="font-medium text-indigo-900">Admin</h3>
                <p className="text-indigo-700 text-sm">Gerenciar sistema</p>
              </button>
              <button
                onClick={() => router.push('/admin/hospitais')}
                className="bg-indigo-50 rounded-lg p-4 text-left hover:bg-indigo-100 transition-colors"
              >
                <h3 className="font-medium text-indigo-900">Hospitais</h3>
                <p className="text-indigo-700 text-sm">Gerenciar hospitais</p>
              </button>
              <button
                onClick={() => router.push('/admin/unidades')}
                className="bg-indigo-50 rounded-lg p-4 text-left hover:bg-indigo-100 transition-colors"
              >
                <h3 className="font-medium text-indigo-900">Unidades</h3>
                <p className="text-indigo-700 text-sm">Gerenciar unidades</p>
              </button>
              <button
                onClick={() => router.push('/admin/convites')}
                className="bg-indigo-50 rounded-lg p-4 text-left hover:bg-indigo-100 transition-colors"
              >
                <h3 className="font-medium text-indigo-900">Convites</h3>
                <p className="text-indigo-700 text-sm">Convidar usuários</p>
              </button>
            </div>
          </div>
        )}

        {(user.role === 'ADMIN_MASTER' || user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Área do Gestor</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/professor/cursos')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Cursos</h3>
                <p className="text-green-700 text-sm">Gerenciar cursos</p>
              </button>
              <button
                onClick={() => router.push('/gestor/atribuicoes')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Atribuições</h3>
                <p className="text-green-700 text-sm">Atribuir cursos</p>
              </button>
              <button
                onClick={() => router.push('/gestor/rankings')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Rankings</h3>
                <p className="text-green-700 text-sm">Ver desempenho</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
