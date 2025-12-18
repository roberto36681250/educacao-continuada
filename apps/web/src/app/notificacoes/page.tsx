'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import Header from '@/components/Header';

interface Notification {
  id: string;
  type: 'TICKET_REPLY' | 'TICKET_STATUS_CHANGE' | 'COURSE_COMPLETED' | 'CERTIFICATE_READY' | 'SYSTEM';
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const typeIcons: Record<string, string> = {
  TICKET_REPLY: '💬',
  TICKET_STATUS_CHANGE: '🔄',
  COURSE_COMPLETED: '🎉',
  CERTIFICATE_READY: '🎓',
  SYSTEM: '📢',
};

export default function NotificacoesPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    try {
      const data = await api<Notification[]>('/me/notifications');
      setNotifications(data);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err: any) {
      console.error('Erro ao marcar como lida:', err);
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await api('/notifications/read-all', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err: any) {
      console.error('Erro ao marcar todas como lidas:', err);
    }
  }

  function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

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
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Notificações</h1>
            <p className="text-gray-600">
              {unreadCount > 0
                ? `${unreadCount} não lida(s)`
                : 'Todas lidas'}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-blue-600 hover:underline text-sm"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-6xl mb-4">🔔</div>
            <h2 className="text-xl font-semibold mb-2">Nenhuma notificação</h2>
            <p className="text-gray-600">
              Você ainda não tem notificações.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow ${
                  !notification.read ? 'border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{typeIcons[notification.type] || '📌'}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className={`font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                        {notification.title}
                      </h3>
                      <span className="text-xs text-gray-400">
                        {new Date(notification.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{notification.message}</p>
                    {notification.link && (
                      <span className="text-xs text-blue-600 mt-1 inline-block">Ver mais →</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link href="/cursos" className="text-blue-600 hover:underline">
            ← Voltar para cursos
          </Link>
        </div>
        </div>
      </div>
    </>
  );
}
