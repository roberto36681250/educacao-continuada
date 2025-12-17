'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Hospital {
  id: string;
  name: string;
  createdAt: string;
  _count: {
    units: number;
  };
}

interface UserData {
  id: string;
  systemRole: string;
  instituteId: string;
}

export default function AdminHospitaisPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        if (userData.systemRole !== 'ADMIN_MASTER') {
          router.push('/admin');
          return;
        }

        const hospitalsData = await api<Hospital[]>(
          `/hospitals?instituteId=${userData.instituteId}`
        );
        setHospitals(hospitalsData);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const newHospital = await api<Hospital>('/hospitals', {
        method: 'POST',
        body: {
          name: formName,
          instituteId: user.instituteId,
        },
      });

      setHospitals((prev) => [
        { ...newHospital, _count: { units: 0 } },
        ...prev,
      ]);
      setFormName('');
      setShowForm(false);
      setSuccess('Hospital criado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar hospital');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const updated = await api<Hospital>(`/hospitals/${editingId}`, {
        method: 'PATCH',
        body: { name: formName },
      });

      setHospitals((prev) =>
        prev.map((h) =>
          h.id === editingId ? { ...h, name: updated.name } : h
        )
      );
      setFormName('');
      setEditingId(null);
      setSuccess('Hospital atualizado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar hospital');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (hospital: Hospital) => {
    setEditingId(hospital.id);
    setFormName(hospital.name);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormName('');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-600">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-12 px-6 bg-gray-50">
      <div className="w-full max-w-3xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Hospitais</h1>
          <a href="/admin" className="text-blue-600 hover:underline">
            Voltar ao painel
          </a>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {success}
          </div>
        )}

        {!showForm && !editingId && (
          <button
            onClick={() => {
              setShowForm(true);
              setError('');
              setSuccess('');
            }}
            className="mb-6 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            + Novo Hospital
          </button>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Novo Hospital</h2>
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Hospital *
              </label>
              <input
                type="text"
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={2}
                maxLength={200}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormName('');
                }}
                className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unidades
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {hospitals.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                    Nenhum hospital cadastrado
                  </td>
                </tr>
              ) : (
                hospitals.map((hospital) => (
                  <tr key={hospital.id}>
                    <td className="px-6 py-4">
                      {editingId === hospital.id ? (
                        <form onSubmit={handleUpdate} className="flex gap-2">
                          <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            className="flex-1 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                            minLength={2}
                            maxLength={200}
                          />
                          <button
                            type="submit"
                            disabled={submitting}
                            className="bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="bg-gray-300 text-gray-700 py-1 px-3 rounded-md hover:bg-gray-400 text-sm"
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <span className="font-medium">{hospital.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {hospital._count.units}
                    </td>
                    <td className="px-6 py-4">
                      {editingId !== hospital.id && (
                        <button
                          onClick={() => startEdit(hospital)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
