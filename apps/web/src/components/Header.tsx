'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { api, removeToken, getToken } from '@/lib/api';
import SearchCommand from './SearchCommand';

interface User {
  id: string;
  name: string;
  role: string;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!getToken()) return;

    async function loadData() {
      try {
        const userData = await api<User>('/auth/me');
        setUser(userData);
        loadNotificationCount();
      } catch {
        // Not logged in
      }
    }
    loadData();
  }, [pathname]);

  async function loadNotificationCount() {
    try {
      const data = await api<{ unreadCount: number }>('/me/notifications/count');
      setUnreadCount(data.unreadCount);
    } catch {
      // Ignore
    }
  }

  function handleLogout() {
    removeToken();
    router.push('/login');
  }

  // Don't show header on login/register pages
  if (pathname === '/login' || pathname === '/registro' || pathname === '/verify') {
    return null;
  }

  if (!user) {
    return null;
  }

  const isManager = ['ADMIN_MASTER', 'ADMIN', 'MANAGER', 'PROFESSOR'].includes(user.role);

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex justify-between items-center">
          <Link href="/cursos" className="font-bold text-xl text-blue-600">
            Educacao Continuada
          </Link>

          <nav className="flex items-center gap-4">
            <SearchCommand />

            <Link
              href="/cursos"
              className={`text-sm ${
                pathname === '/cursos' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cursos
            </Link>

            <Link
              href="/suporte"
              className={`text-sm ${
                pathname.startsWith('/suporte') ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Suporte
            </Link>

            {isManager && (
              <Link
                href="/gestor"
                className={`text-sm ${
                  pathname.startsWith('/gestor') ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Gestor
              </Link>
            )}

            <Link
              href="/notificacoes"
              className="relative text-gray-600 hover:text-gray-900"
            >
              <span className="text-xl">🔔</span>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <span className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                  <div className="px-4 py-2 border-b">
                    <p className="font-medium text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                  <Link
                    href="/meus-certificados"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setShowMenu(false)}
                  >
                    Meus Certificados
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
