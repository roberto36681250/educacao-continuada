'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getApiUrl, getAuthToken } from '@/lib/api';

interface TicketMessage {
  id: string;
  message: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    role: string;
  };
}

interface TicketAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
  };
}

interface Ticket {
  id: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  category: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    name: string;
  };
  assignedTo?: {
    name: string;
  };
  course?: {
    title: string;
  };
  lesson?: {
    title: string;
  };
  messages: TicketMessage[];
  attachments: TicketAttachment[];
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

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTicket();
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [ticket?.messages]);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function loadTicket() {
    try {
      const data = await api<Ticket>(`/tickets/${ticketId}`);
      setTicket(data);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      if (err.message?.includes('404') || err.message?.includes('not found')) {
        router.push('/suporte');
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSendingMessage(true);
    try {
      await api(`/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: { message: newMessage },
      });
      setNewMessage('');
      loadTicket();
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar mensagem');
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Tipo de arquivo não permitido. Use PNG, JPG ou PDF.');
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAuthToken();
      const response = await fetch(`${getApiUrl()}/tickets/${ticketId}/attachments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar arquivo');
      }

      loadTicket();
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar arquivo');
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function handleCloseTicket() {
    if (!confirm('Tem certeza que deseja fechar este chamado?')) return;
    try {
      await api(`/tickets/${ticketId}/close`, { method: 'PATCH' });
      loadTicket();
    } catch (err: any) {
      alert(err.message || 'Erro ao fechar chamado');
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Chamado não encontrado</p>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/suporte" className="text-blue-600 hover:underline text-sm mb-2 inline-block">
            ← Voltar para chamados
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{ticket.subject}</h1>
              <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                <span>{categoryLabels[ticket.category] || ticket.category}</span>
                <span>•</span>
                <span>Aberto em {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}</span>
                {ticket.assignedTo && (
                  <>
                    <span>•</span>
                    <span>Atendido por {ticket.assignedTo.name}</span>
                  </>
                )}
              </div>
              {(ticket.course || ticket.lesson) && (
                <div className="text-sm text-gray-500 mt-1">
                  Contexto: {ticket.course?.title} {ticket.lesson && `> ${ticket.lesson.title}`}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status]}`}>
                {statusLabels[ticket.status]}
              </span>
              {!isClosed && (
                <button
                  onClick={handleCloseTicket}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 border rounded"
                >
                  Fechar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="max-h-[500px] overflow-y-auto p-4 space-y-4">
            {ticket.messages.map((msg) => {
              const isStaff = ['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(msg.author.role);
              return (
                <div
                  key={msg.id}
                  className={`flex ${isStaff ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isStaff
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    <div className="text-xs mb-1 opacity-75">
                      {msg.author.name} • {new Date(msg.createdAt).toLocaleString('pt-BR')}
                    </div>
                    <div className="whitespace-pre-wrap">{msg.message}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Attachments */}
        {ticket.attachments.length > 0 && (
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h3 className="font-semibold mb-3">Anexos ({ticket.attachments.length})</h3>
            <div className="space-y-2">
              {ticket.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {att.mimeType.includes('pdf') ? '📄' : '🖼️'}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{att.filename}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(att.sizeBytes)} • {att.uploadedBy.name}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`${getApiUrl()}/tickets/attachments/${att.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Baixar
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reply form */}
        {!isClosed ? (
          <div className="bg-white rounded-lg shadow p-4">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              placeholder="Digite sua mensagem..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <div className="flex justify-between items-center mt-3">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept=".png,.jpg,.jpeg,.pdf"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`cursor-pointer text-sm text-gray-600 hover:text-gray-800 ${
                    uploadingFile ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  {uploadingFile ? '📎 Enviando...' : '📎 Anexar arquivo'}
                </label>
                <span className="text-xs text-gray-400 ml-2">(PNG, JPG, PDF - máx 5MB)</span>
              </div>
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !newMessage.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingMessage ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-100 rounded-lg p-4 text-center text-gray-600">
            Este chamado foi fechado. Abra um novo chamado se precisar de mais ajuda.
          </div>
        )}
      </div>
    </div>
  );
}
