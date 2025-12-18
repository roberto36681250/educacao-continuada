'use client';

import { useEffect, useState } from 'react';
import { api, apiClient } from '@/lib/api';
import LoadingState from '@/components/LoadingState';

interface EmailOutbox {
  id: string;
  eventKey: string;
  toEmail: string;
  toName: string | null;
  templateKey: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
  scheduledAt: string;
  sentAt: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  audits: Array<{
    id: string;
    action: string;
    meta: any;
    createdAt: string;
  }>;
}

interface QueueStats {
  byStatus: {
    pending: number;
    sending: number;
    sent: number;
    failed: number;
    cancelled: number;
    skipped: number;
  };
  sentLast24h: number;
  byEventKey: Array<{ eventKey: string; count: number }>;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  SENDING: { label: 'Enviando', color: 'bg-blue-100 text-blue-800' },
  SENT: { label: 'Enviado', color: 'bg-green-100 text-green-800' },
  FAILED: { label: 'Falhou', color: 'bg-red-100 text-red-800' },
  CANCELLED: { label: 'Cancelado', color: 'bg-gray-100 text-gray-800' },
  SKIPPED: { label: 'Ignorado', color: 'bg-purple-100 text-purple-800' },
};

const eventKeyLabels: Record<string, string> = {
  INVITE_CREATED: 'Convite',
  ASSIGNMENT_DUE_SOON: 'Prazo Proximo',
  ASSIGNMENT_OVERDUE: 'Em Atraso',
  REVIEW_DUE: 'Revisao Pendente',
  WEEKLY_DIGEST: 'Digest Semanal',
};

export default function ComunicacaoPage() {
  const [emails, setEmails] = useState<EmailOutbox[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [eventFilter, setEventFilter] = useState<string>('');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter, eventFilter]);

  async function loadData() {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (eventFilter) params.append('eventKey', eventFilter);

      const [emailsData, statsData] = await Promise.all([
        apiClient.get<EmailOutbox[]>(`/gestor/comunicacao/fila?${params.toString()}`),
        apiClient.get<QueueStats>('/gestor/comunicacao/estatisticas'),
      ]);
      setEmails(emailsData);
      setStats(statsData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(id: string) {
    setRetrying(id);
    setError('');
    try {
      await apiClient.post(`/gestor/comunicacao/reenviar/${id}`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao reenviar');
    } finally {
      setRetrying(null);
    }
  }

  async function handleTriggerProcess() {
    setTriggering(true);
    setError('');
    try {
      await apiClient.post('/gestor/comunicacao/processar');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar fila');
    } finally {
      setTriggering(false);
    }
  }

  async function handleRunScheduler(type: 'daily-reminders' | 'weekly-digest') {
    setTriggering(true);
    setError('');
    try {
      await apiClient.post(`/gestor/comunicacao/scheduler/${type}`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao executar scheduler');
    } finally {
      setTriggering(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <LoadingState message="Carregando comunicacao..." />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Comunicacao</h1>
          <p className="text-gray-600">Fila de emails e notificacoes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleRunScheduler('daily-reminders')}
            disabled={triggering}
            className="px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            Executar Lembretes
          </button>
          <button
            onClick={() => handleRunScheduler('weekly-digest')}
            disabled={triggering}
            className="px-3 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            Executar Digest
          </button>
          <button
            onClick={handleTriggerProcess}
            disabled={triggering}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {triggering ? 'Processando...' : 'Processar Fila'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">{stats.byStatus.pending}</div>
            <div className="text-sm text-gray-500">Pendentes</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{stats.byStatus.sending}</div>
            <div className="text-sm text-gray-500">Enviando</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">{stats.byStatus.sent}</div>
            <div className="text-sm text-gray-500">Enviados</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-red-600">{stats.byStatus.failed}</div>
            <div className="text-sm text-gray-500">Falharam</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-600">{stats.byStatus.cancelled}</div>
            <div className="text-sm text-gray-500">Cancelados</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">{stats.byStatus.skipped}</div>
            <div className="text-sm text-gray-500">Ignorados</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-teal-600">{stats.sentLast24h}</div>
            <div className="text-sm text-gray-500">Ultimas 24h</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="PENDING">Pendente</option>
              <option value="SENDING">Enviando</option>
              <option value="SENT">Enviado</option>
              <option value="FAILED">Falhou</option>
              <option value="CANCELLED">Cancelado</option>
              <option value="SKIPPED">Ignorado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="border rounded px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="INVITE_CREATED">Convite</option>
              <option value="ASSIGNMENT_DUE_SOON">Prazo Proximo</option>
              <option value="ASSIGNMENT_OVERDUE">Em Atraso</option>
              <option value="REVIEW_DUE">Revisao Pendente</option>
              <option value="WEEKLY_DIGEST">Digest Semanal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Destinatario
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Data
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tentativas
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Acoes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {emails.map((email) => (
              <tr key={email.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium">
                    {eventKeyLabels[email.eventKey] || email.eventKey}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">{email.toEmail}</div>
                  {email.toName && (
                    <div className="text-xs text-gray-500">{email.toName}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      statusConfig[email.status]?.color || 'bg-gray-100'
                    }`}
                  >
                    {statusConfig[email.status]?.label || email.status}
                  </span>
                  {email.lastError && (
                    <div className="text-xs text-red-500 mt-1 max-w-xs truncate">
                      {email.lastError}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {email.sentAt
                    ? new Date(email.sentAt).toLocaleString('pt-BR')
                    : new Date(email.createdAt).toLocaleString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{email.attempts}</td>
                <td className="px-4 py-3">
                  {(email.status === 'FAILED' || email.status === 'CANCELLED') && (
                    <button
                      onClick={() => handleRetry(email.id)}
                      disabled={retrying === email.id}
                      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {retrying === email.id ? 'Reenviando...' : 'Reenviar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {emails.length === 0 && (
          <div className="p-8 text-center text-gray-500">Nenhum email encontrado</div>
        )}
      </div>
    </main>
  );
}
