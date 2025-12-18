'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import Header from '@/components/Header';

interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  category: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
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

export default function SuportePage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [newTicket, setNewTicket] = useState({ subject: '', message: '', category: 'OTHER' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      const data = await api<Ticket[]>('/me/tickets');
      setTickets(data);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTicket() {
    if (!newTicket.subject.trim() || !newTicket.message.trim()) return;
    setSubmitting(true);
    try {
      await api('/tickets', {
        method: 'POST',
        body: {
          subject: newTicket.subject,
          message: newTicket.message,
          category: newTicket.category,
        },
      });
      setShowNewTicketModal(false);
      setNewTicket({ subject: '', message: '', category: 'OTHER' });
      loadTickets();
    } catch (err: any) {
      alert(err.message || 'Erro ao criar ticket');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Meus Chamados</h1>
            <p className="text-gray-600">Acompanhe suas dúvidas e solicitações</p>
          </div>
          <button
            onClick={() => setShowNewTicketModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            + Novo Chamado
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">📭</div>
            <h2 className="text-xl font-semibold mb-2">Nenhum chamado</h2>
            <p className="text-gray-600 mb-4">
              Você ainda não abriu nenhum chamado de suporte.
            </p>
            <button
              onClick={() => setShowNewTicketModal(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            >
              Abrir Chamado
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/suporte/${ticket.id}`}
                className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{ticket.subject}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span>{categoryLabels[ticket.category] || ticket.category}</span>
                      <span>•</span>
                      <span>{ticket._count.messages} mensagem(ns)</span>
                      <span>•</span>
                      <span>{new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                    {statusLabels[ticket.status]}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link href="/cursos" className="text-blue-600 hover:underline">
            ← Voltar para cursos
          </Link>
        </div>
      </div>

      {/* Modal Novo Chamado */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Novo Chamado</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categoria
                </label>
                <select
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CONTENT">Conteúdo</option>
                  <option value="QUIZ">Quiz</option>
                  <option value="TECHNICAL">Técnico</option>
                  <option value="CERTIFICATE">Certificado</option>
                  <option value="ASSIGNMENT">Atividade</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assunto
                </label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Resumo do seu problema ou dúvida"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensagem
                </label>
                <textarea
                  value={newTicket.message}
                  onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Descreva em detalhes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewTicketModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={submitting || !newTicket.subject.trim() || !newTicket.message.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Criar Chamado'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
