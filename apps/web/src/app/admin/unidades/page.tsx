'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Hospital {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
  hospitalId: string;
  createdAt: string;
  hospital: {
    id: string;
    name: string;
  };
}

interface UserData {
  id: string;
  systemRole: string;
  instituteId: string;
}

export default function AdminUnidadesPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formHospitalId, setFormHospitalId] = useState('');
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

  const loadUnits = async (hospitalId: string) => {
    if (!hospitalId) {
      setUnits([]);
      return;
    }

    try {
      const unitsData = await api<Unit[]>(`/units?hospitalId=${hospitalId}`);
      setUnits(unitsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar unidades');
    }
  };

  const handleHospitalFilter = async (hospitalId: string) => {
    setSelectedHospitalId(hospitalId);
    setError('');
    setSuccess('');
    await loadUnits(hospitalId);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const newUnit = await api<Unit>('/units', {
        method: 'POST',
        body: {
          name: formName,
          hospitalId: formHospitalId,
        },
      });

      const hospital = hospitals.find((h) => h.id === formHospitalId);
      const unitWithHospital = {
        ...newUnit,
        hospital: hospital ? { id: hospital.id, name: hospital.name } : { id: '', name: '' },
      };

      if (selectedHospitalId === formHospitalId || !selectedHospitalId) {
        setUnits((prev) => [unitWithHospital, ...prev]);
      }

      setFormName('');
      setFormHospitalId('');
      setShowForm(false);
      setSuccess('Unidade criada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar unidade');
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
      const updated = await api<Unit>(`/units/${editingId}`, {
        method: 'PATCH',
        body: { name: formName },
      });

      setUnits((prev) =>
        prev.map((u) => (u.id === editingId ? { ...u, name: updated.name } : u))
      );
      setFormName('');
      setEditingId(null);
      setSuccess('Unidade atualizada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar unidade');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setFormName(unit.name);
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
          <h1 className="text-3xl font-bold">Unidades</h1>
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

        <div className="mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label
              htmlFor="hospitalFilter"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Filtrar por Hospital
            </label>
            <select
              id="hospitalFilter"
              value={selectedHospitalId}
              onChange={(e) => handleHospitalFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione um hospital...</option>
              {hospitals.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.name}
                </option>
              ))}
            </select>
          </div>

          {!showForm && !editingId && selectedHospitalId && (
            <button
              onClick={() => {
                setShowForm(true);
                setFormHospitalId(selectedHospitalId);
                setError('');
                setSuccess('');
              }}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
            >
              + Nova Unidade
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Nova Unidade</h2>

            <div className="mb-4">
              <label
                htmlFor="formHospital"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Hospital *
              </label>
              <select
                id="formHospital"
                value={formHospitalId}
                onChange={(e) => setFormHospitalId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione...</option>
                {hospitals.map((hospital) => (
                  <option key={hospital.id} value={hospital.id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Unidade *
              </label>
              <input
                type="text"
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: UTI Adulto A"
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
                  setFormHospitalId('');
                }}
                className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {!selectedHospitalId ? (
          <div className="bg-white shadow-md rounded-lg p-6 text-center text-gray-500">
            Selecione um hospital para ver as unidades
          </div>
        ) : (
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hospital
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {units.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                      Nenhuma unidade cadastrada neste hospital
                    </td>
                  </tr>
                ) : (
                  units.map((unit) => (
                    <tr key={unit.id}>
                      <td className="px-6 py-4">
                        {editingId === unit.id ? (
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
                          <span className="font-medium">{unit.name}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{unit.hospital.name}</td>
                      <td className="px-6 py-4">
                        {editingId !== unit.id && (
                          <button
                            onClick={() => startEdit(unit)}
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
        )}
      </div>
    </main>
  );
}
