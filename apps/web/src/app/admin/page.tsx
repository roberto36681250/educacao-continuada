'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface UserData {
  id: string;
  name: string;
  systemRole: string;
  instituteId: string;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        if (!['ADMIN_MASTER', 'ADMIN'].includes(userData.systemRole)) {
          router.push('/me');
          return;
        }
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-600">Carregando...</p>
      </main>
    );
  }

  const isAdminMaster = user?.systemRole === 'ADMIN_MASTER';

  return (
    <main className="flex min-h-screen flex-col items-center py-12 px-6 bg-gray-50">
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Painel Administrativo</h1>
            <p className="text-gray-600">Olá, {user?.name}</p>
          </div>
          <a href="/me" className="text-blue-600 hover:underline">
            Meu Perfil
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isAdminMaster && (
            <>
              <a
                href="/admin/hospitais"
                className="block bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-3">🏥</div>
                <h2 className="text-xl font-semibold mb-2">Hospitais</h2>
                <p className="text-gray-600 text-sm">
                  Cadastrar e gerenciar hospitais do instituto
                </p>
              </a>

              <a
                href="/admin/unidades"
                className="block bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="text-3xl mb-3">🏢</div>
                <h2 className="text-xl font-semibold mb-2">Unidades</h2>
                <p className="text-gray-600 text-sm">
                  Cadastrar e gerenciar UTIs e setores
                </p>
              </a>
            </>
          )}

          <a
            href="/admin/convites"
            className="block bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow"
          >
            <div className="text-3xl mb-3">📧</div>
            <h2 className="text-xl font-semibold mb-2">Convites</h2>
            <p className="text-gray-600 text-sm">
              Criar convites e gerenciar cadastros
            </p>
          </a>
        </div>
      </div>
    </main>
  );
}
