'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getApiUrl, getAuthToken } from '@/lib/api';

interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  category: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  assignedTo?: {
    id: string;
    name: string;
  };
  _count: {
    messages: number;
  };
}

interface Manager {
  id: string;
  name: string;
  email: string;
}

const statusLabels: Record<string, string> = {
  OPEN: 'Aberto',
  IN_PROGRESS: 'Em Andamento',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
};

const statusColors: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

const categoryLabels: Record<string, string> = {
  CONTENT: 'Conteúdo',
  QUIZ: 'Quiz',
  TECHNICAL: 'Técnico',
  CERTIFICATE: 'Certificado',
  ASSIGNMENT: 'Atividade',
  OTHER: 'Outro',
};

const priorityLabels: Record<string, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
};

const priorityColors: Record<string, string> = {
  LOW: 'text-gray-500',
  MEDIUM: 'text-yellow-600',
  HIGH: 'text-red-600 font-semibold',
};

export default function GestorTicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    from: '',
    to: '',
  });
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadTickets();
  }, [filters]);

  async function loadTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);

      const data = await api<Ticket[]>(`/tickets?${params.toString()}`);
      setTickets(data);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        router.push('/cursos');
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(ticketId: string, status: string) {
    setUpdatingStatus(true);
    try {
      await api(`/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: { status },
      });
      loadTickets();
      setSelectedTicket(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAssign(ticketId: string, userId: string | null) {
    try {
      await api(`/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        body: { assignedToUserId: userId },
      });
      loadTickets();
      setSelectedTicket(null);
    } catch (err: any) {
      alert(err.message || 'Erro ao atribuir ticket');
    }
  }

  function handleExportCSV() {
    const params = new URLSearchParams();
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);

    const token = getAuthToken();
    window.open(
      `${getApiUrl()}/tickets/export.csv?${params.toString()}&token=${token}`,
      '_blank'
    );
  }

  const openTickets = tickets.filter((t) => t.status === 'OPEN').length;
  const inProgressTickets = tickets.filter((t) => t.status === 'IN_PROGRESS').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestão de Chamados</h1>
            <p className="text-gray-600">
              {openTickets} abertos • {inProgressTickets} em andamento • {tickets.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              📊 Exportar CSV
            </button>
            <Link
              href="/gestor"
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Voltar
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Todos</option>
                <option value="OPEN">Aberto</option>
                <option value="IN_PROGRESS">Em Andamento</option>
                <option value="RESOLVED">Resolvido</option>
                <option value="CLOSED">Fechado</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Todas</option>
                <option value="CONTENT">Conteúdo</option>
                <option value="QUIZ">Quiz</option>
                <option value="TECHNICAL">Técnico</option>
                <option value="CERTIFICATE">Certificado</option>
                <option value="ASSIGNMENT">Atividade</option>
                <option value="OTHER">Outro</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="">Todas</option>
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">De</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Até</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                className="w-full px-3 py-2 border rounded"
              />
            </div>
          </div>
        </div>

        {/* Tickets table */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Carregando...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nenhum chamado encontrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Assunto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Prioridade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <Link
                          href={`/suporte/${ticket.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {ticket.subject}
                        </Link>
                        <p className="text-xs text-gray-500">{ticket._count.messages} msg</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div>
                        <p>{ticket.createdBy.name}</p>
                        <p className="text-xs text-gray-500">{ticket.createdBy.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {categoryLabels[ticket.category] || ticket.category}
                    </td>
                    <td className={`px-6 py-4 text-sm ${priorityColors[ticket.priority]}`}>
                      {priorityLabels[ticket.priority] || ticket.priority}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusColors[ticket.status]
                        }`}
                      >
                        {statusLabels[ticket.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value)}
                        className="text-sm border rounded px-2 py-1"
                        disabled={updatingStatus}
                      >
                        <option value="OPEN">Aberto</option>
                        <option value="IN_PROGRESS">Em Andamento</option>
                        <option value="RESOLVED">Resolvido</option>
                        <option value="CLOSED">Fechado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
