'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api, removeToken } from '@/lib/api';

interface UserData {
  id: string;
  email: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  profession: string | null;
  professionalRegister: string | null;
  systemRole: string;
  createdAt: string;
}

export default function MePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchUser() {
      try {
        const data = await api<UserData>('/auth/me');
        setUser(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        removeToken();
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  const roleLabels: Record<string, string> = {
    ADMIN_MASTER: 'Administrador Master',
    ADMIN: 'Administrador',
    MANAGER: 'Gestor',
    USER: 'Usuário',
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-600">Carregando...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Erro</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/login" className="text-blue-600 hover:underline">
            Ir para login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-8">Educação Continuada</h1>

        <div className="bg-white shadow-md rounded-lg p-8">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold">Meu Perfil</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
              {roleLabels[user?.systemRole || ''] || user?.systemRole}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500">Nome</label>
              <p className="text-gray-900">{user?.name}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">E-mail</label>
              <p className="text-gray-900">{user?.email}</p>
            </div>

            {user?.cpf && (
              <div>
                <label className="block text-sm font-medium text-gray-500">CPF</label>
                <p className="text-gray-900">{user.cpf}</p>
              </div>
            )}

            {user?.phone && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Telefone</label>
                <p className="text-gray-900">{user.phone}</p>
              </div>
            )}

            {user?.profession && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Profissão</label>
                <p className="text-gray-900">{user.profession}</p>
              </div>
            )}

            {user?.professionalRegister && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Registro Profissional</label>
                <p className="text-gray-900">{user.professionalRegister}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-500">Membro desde</label>
              <p className="text-gray-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
          </div>

          {['ADMIN_MASTER', 'ADMIN'].includes(user?.systemRole || '') && (
            <a
              href="/admin"
              className="block w-full mt-6 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 text-center"
            >
              Painel Administrativo
            </a>
          )}

          <button
            onClick={handleLogout}
            className="w-full mt-4 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700"
          >
            Sair
          </button>
        </div>
      </div>
    </main>
  );
}
