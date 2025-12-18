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

interface HomeDataAluno {
  role: 'USER';
  pendingAssignments: Array<{
    id: string;
    title: string;
    dueAt: string;
    isOverdue: boolean;
    course: { id: string; title: string };
  }>;
  dueReviews: Array<{
    id: string;
    dueAt: string;
    status: string;
    competency: { id: string; name: string };
  }>;
  continueLesson: {
    lessonId: string;
    title: string;
    courseId: string;
    courseTitle: string;
    watchedPct: number;
  } | null;
  recentCertificates: Array<{
    id: string;
    code: string;
    courseTitle: string;
    issuedAt: string;
  }>;
}

interface HomeDataGestor {
  role: 'MANAGER' | 'ADMIN' | 'ADMIN_MASTER';
  summary: {
    activeAssignments: number;
    openTickets: number;
    onTimePercentage: number;
    redCompetencies: number;
  };
  recentTickets: Array<{
    id: string;
    subject: string;
    status: string;
    createdAt: string;
  }>;
}

type HomeData = HomeDataAluno | HomeDataGestor;

function isGestorData(data: HomeData): data is HomeDataGestor {
  return data.role !== 'USER';
}

function isAlunoData(data: HomeData): data is HomeDataAluno {
  return data.role === 'USER';
}

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [homeData, setHomeData] = useState<HomeData | null>(null);
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

      // Load home data from smart endpoint
      try {
        const data = await api<HomeData>('/me/home');
        setHomeData(data);
      } catch {
        // Ignore errors loading home data
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
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
      </main>
    );
  }

  // Not logged in - show landing page
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <h1 className="text-4xl font-bold text-center">Educacao Continuada</h1>
        <p className="mt-4 text-lg text-gray-600">
          Plataforma de Educacao Continuada para equipes hospitalares
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
            Ola, {user.name.split(' ')[0]}!
          </h1>
          <p className="text-gray-600">Bem-vindo a plataforma de Educacao Continuada</p>
        </div>

        {/* Gestor Summary */}
        {homeData && isGestorData(homeData) && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Resumo do Mes</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Atribuicoes Ativas</p>
                <p className="text-3xl font-bold text-blue-600">
                  {homeData.summary.activeAssignments}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Chamados Abertos</p>
                <p className="text-3xl font-bold text-yellow-600">
                  {homeData.summary.openTickets}
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Conclusoes no Prazo</p>
                <p className="text-3xl font-bold text-green-600">
                  {homeData.summary.onTimePercentage}%
                </p>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <p className="text-sm text-gray-500">Competencias em Risco</p>
                <p className="text-3xl font-bold text-red-600">
                  {homeData.summary.redCompetencies}
                </p>
              </div>
            </div>

            {/* Recent tickets */}
            {homeData.recentTickets.length > 0 && (
              <div className="mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-medium text-gray-700">Chamados Recentes</h3>
                  <button
                    onClick={() => router.push('/gestor/tickets')}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Ver todos
                  </button>
                </div>
                <div className="bg-white rounded-lg shadow divide-y">
                  {homeData.recentTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-3 flex justify-between items-center hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/gestor/tickets/${ticket.id}`)}
                    >
                      <div>
                        <p className="font-medium text-sm">{ticket.subject}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(ticket.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          ticket.status === 'OPEN'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {ticket.status === 'OPEN' ? 'Aberto' : 'Em Andamento'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aluno Home */}
        {homeData && isAlunoData(homeData) && (
          <>
            {/* Continue watching */}
            {homeData.continueLesson && (
              <div className="mb-8">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white">
                  <p className="text-sm opacity-90 mb-2">Continuar de onde parou</p>
                  <h2 className="text-xl font-bold mb-1">
                    {homeData.continueLesson.title}
                  </h2>
                  <p className="text-sm opacity-80 mb-4">
                    {homeData.continueLesson.courseTitle}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 bg-white/20 rounded-full h-2">
                      <div
                        className="bg-white rounded-full h-2"
                        style={{ width: `${homeData.continueLesson.watchedPct}%` }}
                      />
                    </div>
                    <span className="text-sm">{homeData.continueLesson.watchedPct}%</span>
                    <button
                      onClick={() =>
                        router.push(`/aula/${homeData.continueLesson!.lessonId}`)
                      }
                      className="bg-white text-blue-600 px-4 py-2 rounded font-medium hover:bg-blue-50"
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Pending reviews alert */}
            {homeData.dueReviews.length > 0 && (
              <div className="mb-8">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-purple-800">
                        Voce tem {homeData.dueReviews.length} revisao(oes) pendente(s)
                      </h2>
                      <p className="text-purple-700 text-sm">
                        Complete suas revisoes para manter suas competencias em dia
                      </p>
                    </div>
                    <button
                      onClick={() => router.push('/revisoes')}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                    >
                      Ver todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {homeData.dueReviews.slice(0, 4).map((review) => {
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
                            <h3 className="font-medium text-gray-900">
                              {review.competency.name}
                            </h3>
                            <p
                              className={`text-sm mt-1 ${
                                isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'
                              }`}
                            >
                              {isOverdue
                                ? `Atrasada (${formatDate(review.dueAt)})`
                                : `Prazo: ${formatDate(review.dueAt)}`}
                            </p>
                          </div>
                          <button
                            onClick={() => router.push(`/revisoes/${review.id}`)}
                            className="ml-2 px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                          >
                            Fazer Revisao
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending assignments alert */}
            {homeData.pendingAssignments.length > 0 && (
              <div className="mb-8">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-yellow-800">
                        Voce tem {homeData.pendingAssignments.length} atribuicao(oes) pendente(s)
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {homeData.pendingAssignments.slice(0, 4).map((item) => {
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
                            <h3 className="font-medium text-gray-900">{item.title}</h3>
                            <p className="text-sm text-gray-600">{item.course.title}</p>
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
                            onClick={() => router.push(`/curso/${item.course.id}`)}
                            className="ml-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Continuar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent certificates */}
            {homeData.recentCertificates.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Certificados Recentes
                  </h2>
                  <button
                    onClick={() => router.push('/meus-certificados')}
                    className="text-blue-600 text-sm hover:underline"
                  >
                    Ver todos
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {homeData.recentCertificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500"
                    >
                      <h3 className="font-medium text-gray-900">{cert.courseTitle}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Emitido em {formatDate(cert.issuedAt)}
                      </p>
                      <button
                        onClick={() => router.push(`/certificado/${cert.id}`)}
                        className="mt-2 text-blue-600 text-sm hover:underline"
                      >
                        Ver certificado
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Quick access cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => router.push('/cursos')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Meus Cursos</h3>
            <p className="text-gray-600 text-sm mt-1">
              Acesse os cursos disponiveis para voce
            </p>
          </button>

          <button
            onClick={() => router.push('/minhas-atribuicoes')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Minhas Atribuicoes</h3>
            <p className="text-gray-600 text-sm mt-1">
              Veja os cursos atribuidos a voce com prazo
            </p>
          </button>

          <button
            onClick={() => router.push('/me')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Meu Perfil</h3>
            <p className="text-gray-600 text-sm mt-1">Veja suas informacoes e lotacao</p>
          </button>

          <button
            onClick={() => router.push('/meus-certificados')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Meus Certificados</h3>
            <p className="text-gray-600 text-sm mt-1">Veja e baixe seus certificados</p>
          </button>

          <button
            onClick={() => router.push('/revisoes')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Minhas Revisoes</h3>
            <p className="text-gray-600 text-sm mt-1">
              Revise suas competencias periodicamente
            </p>
          </button>

          <button
            onClick={() => router.push('/suporte')}
            className="bg-white rounded-lg shadow p-6 text-left hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-semibold text-gray-900">Suporte</h3>
            <p className="text-gray-600 text-sm mt-1">Abra um chamado de suporte</p>
          </button>
        </div>

        {/* Role-specific actions */}
        {(user.role === 'ADMIN_MASTER' || user.role === 'ADMIN') && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Area Administrativa
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
                <p className="text-indigo-700 text-sm">Convidar usuarios</p>
              </button>
            </div>
          </div>
        )}

        {(user.role === 'ADMIN_MASTER' || user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Area do Gestor</h2>
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
                <h3 className="font-medium text-green-900">Atribuicoes</h3>
                <p className="text-green-700 text-sm">Atribuir cursos</p>
              </button>
              <button
                onClick={() => router.push('/gestor/rankings')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Rankings</h3>
                <p className="text-green-700 text-sm">Ver desempenho</p>
              </button>
              <button
                onClick={() => router.push('/gestor/certificados')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Certificados</h3>
                <p className="text-green-700 text-sm">Ver certificados emitidos</p>
              </button>
              <button
                onClick={() => router.push('/gestor/competencias')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Competencias</h3>
                <p className="text-green-700 text-sm">Gerenciar competencias</p>
              </button>
              <button
                onClick={() => router.push('/gestor/risco')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Mapa de Risco</h3>
                <p className="text-green-700 text-sm">Ver estados de competencias</p>
              </button>
              <button
                onClick={() => router.push('/gestor/tickets')}
                className="bg-green-50 rounded-lg p-4 text-left hover:bg-green-100 transition-colors"
              >
                <h3 className="font-medium text-green-900">Chamados</h3>
                <p className="text-green-700 text-sm">Gerenciar suporte</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
