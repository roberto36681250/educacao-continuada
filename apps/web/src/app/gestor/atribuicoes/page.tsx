'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Course {
  id: string;
  title: string;
}

interface Unit {
  id: string;
  name: string;
  hospital: { id: string; name: string };
}

interface Hospital {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  profession: string;
}

interface Scope {
  id?: string;
  scopeType: 'INSTITUTE_ALL' | 'INSTITUTE_PROFESSION' | 'HOSPITAL_ALL' | 'UNIT_ALL' | 'UNIT_PROFESSION' | 'INDIVIDUAL';
  unitId?: string;
  hospitalId?: string;
  profession?: string;
  userIds?: string[];
}

interface Assignment {
  id: string;
  title: string;
  startAt: string;
  dueAt: string;
  course: { id: string; title: string };
  scopes: Scope[];
  _count?: { statuses: number };
}

const PROFESSIONS = [
  'Médico',
  'Enfermeiro',
  'Fisioterapeuta',
  'Farmacêutico',
  'Nutricionista',
  'Psicólogo',
  'Assistente Social',
  'Técnico de Enfermagem',
];

export default function GestorAtribuicoesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    courseId: '',
    title: '',
    startAt: '',
    dueAt: '',
  });
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const userData = await api<any>('/auth/me');
      setUser(userData);

      if (!['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userData.role)) {
        router.push('/cursos');
        return;
      }

      const [assignmentsData, coursesData, unitsData, hospitalsData, usersData] = await Promise.all([
        api<Assignment[]>('/assignments'),
        api<Course[]>('/courses'),
        api<Unit[]>(`/units?instituteId=${userData.instituteId}`),
        api<Hospital[]>(`/hospitals?instituteId=${userData.instituteId}`),
        api<User[]>(`/users?instituteId=${userData.instituteId}`),
      ]);

      setAssignments(assignmentsData);
      setCourses(coursesData);
      setUnits(unitsData);
      setHospitals(hospitalsData);
      setAllUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function addScope() {
    setScopes([...scopes, { scopeType: 'UNIT_ALL' }]);
  }

  function removeScope(index: number) {
    setScopes(scopes.filter((_, i) => i !== index));
  }

  function updateScope(index: number, field: string, value: string | string[]) {
    const newScopes = [...scopes];
    (newScopes[index] as any)[field] = value;
    setScopes(newScopes);
  }

  function toggleUserInScope(index: number, userId: string) {
    const newScopes = [...scopes];
    const scope = newScopes[index];
    const currentUserIds = scope.userIds || [];
    if (currentUserIds.includes(userId)) {
      scope.userIds = currentUserIds.filter((id) => id !== userId);
    } else {
      scope.userIds = [...currentUserIds, userId];
    }
    setScopes(newScopes);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (scopes.length === 0) {
      setError('Adicione pelo menos um escopo');
      return;
    }

    // Validar scopes
    for (const scope of scopes) {
      if (scope.scopeType === 'UNIT_ALL' && !scope.unitId) {
        setError('Selecione uma unidade para o escopo "Unidade Inteira"');
        return;
      }
      if (scope.scopeType === 'UNIT_PROFESSION' && (!scope.unitId || !scope.profession)) {
        setError('Selecione unidade e profissão para o escopo "Profissão na Unidade"');
        return;
      }
      if (scope.scopeType === 'INSTITUTE_PROFESSION' && !scope.profession) {
        setError('Selecione uma profissão para o escopo "Profissão no Instituto"');
        return;
      }
      if (scope.scopeType === 'HOSPITAL_ALL' && !scope.hospitalId) {
        setError('Selecione um hospital para o escopo "Hospital Inteiro"');
        return;
      }
      if (scope.scopeType === 'INDIVIDUAL' && (!scope.userIds || scope.userIds.length === 0)) {
        setError('Selecione pelo menos um usuário para o escopo "Usuários Específicos"');
        return;
      }
    }

    setSubmitting(true);
    try {
      const newAssignment = await api<Assignment>('/assignments', {
        method: 'POST',
        body: {
          ...formData,
          scopes,
        },
      });

      setAssignments([newAssignment, ...assignments]);
      setShowForm(false);
      setFormData({ courseId: '', title: '', startAt: '', dueAt: '' });
      setScopes([]);
      setSuccess('Atribuição criada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar atribuição');
    } finally {
      setSubmitting(false);
    }
  }

  function exportCSV() {
    const headers = ['Título', 'Curso', 'Início', 'Prazo', 'Escopos', 'Participantes'];
    const rows = assignments.map((a) => [
      a.title,
      a.course.title,
      new Date(a.startAt).toLocaleDateString('pt-BR'),
      new Date(a.dueAt).toLocaleDateString('pt-BR'),
      a.scopes.map((s) => {
        if (s.scopeType === 'UNIT_ALL') return `Unidade: ${units.find((u) => u.id === s.unitId)?.name || s.unitId}`;
        if (s.scopeType === 'INSTITUTE_PROFESSION') return `Profissão: ${s.profession}`;
        return `${s.profession} em ${units.find((u) => u.id === s.unitId)?.name || s.unitId}`;
      }).join('; '),
      a._count?.statuses || 0,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atribuicoes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Atribuições de Cursos</h1>
            <p className="text-gray-600">Gerencie obrigações e prazos</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportCSV}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Exportar CSV
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Nova Atribuição
            </button>
          </div>
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

        {/* Formulário de criação */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Nova Atribuição</h2>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Curso
                  </label>
                  <select
                    value={formData.courseId}
                    onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  >
                    <option value="">Selecione um curso</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título da Atribuição
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Ex: Treinamento Sepse Janeiro"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formData.startAt}
                    onChange={(e) => setFormData({ ...formData, startAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prazo Final
                  </label>
                  <input
                    type="date"
                    value={formData.dueAt}
                    onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    required
                  />
                </div>
              </div>

              {/* Escopos */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Escopos (quem deve fazer)
                  </label>
                  <button
                    type="button"
                    onClick={addScope}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    + Adicionar escopo
                  </button>
                </div>

                {scopes.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nenhum escopo adicionado</p>
                ) : (
                  <div className="space-y-3">
                    {scopes.map((scope, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 p-3 rounded"
                      >
                        <div className="flex gap-2 items-center flex-wrap">
                          <select
                            value={scope.scopeType}
                            onChange={(e) => updateScope(index, 'scopeType', e.target.value)}
                            className="px-3 py-2 border rounded"
                          >
                            <option value="INSTITUTE_ALL">Instituto Inteiro (todos)</option>
                            <option value="INSTITUTE_PROFESSION">Profissão no Instituto</option>
                            <option value="HOSPITAL_ALL">Hospital Inteiro</option>
                            <option value="UNIT_ALL">Unidade Inteira</option>
                            <option value="UNIT_PROFESSION">Profissão na Unidade</option>
                            <option value="INDIVIDUAL">Usuários Específicos</option>
                          </select>

                          {/* Hospital selector for HOSPITAL_ALL */}
                          {scope.scopeType === 'HOSPITAL_ALL' && (
                            <select
                              value={scope.hospitalId || ''}
                              onChange={(e) => updateScope(index, 'hospitalId', e.target.value)}
                              className="px-3 py-2 border rounded"
                            >
                              <option value="">Selecione o hospital</option>
                              {hospitals.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name}
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Unit selector for UNIT_ALL and UNIT_PROFESSION */}
                          {(scope.scopeType === 'UNIT_ALL' ||
                            scope.scopeType === 'UNIT_PROFESSION') && (
                            <select
                              value={scope.unitId || ''}
                              onChange={(e) => updateScope(index, 'unitId', e.target.value)}
                              className="px-3 py-2 border rounded"
                            >
                              <option value="">Selecione a unidade</option>
                              {units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} ({u.hospital.name})
                                </option>
                              ))}
                            </select>
                          )}

                          {/* Profession selector for profession-based scopes */}
                          {(scope.scopeType === 'INSTITUTE_PROFESSION' ||
                            scope.scopeType === 'UNIT_PROFESSION') && (
                            <select
                              value={scope.profession || ''}
                              onChange={(e) => updateScope(index, 'profession', e.target.value)}
                              className="px-3 py-2 border rounded"
                            >
                              <option value="">Selecione a profissão</option>
                              {PROFESSIONS.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={() => removeScope(index)}
                            className="text-red-600 hover:text-red-800 ml-auto"
                          >
                            ×
                          </button>
                        </div>

                        {/* User selector for INDIVIDUAL scope */}
                        {scope.scopeType === 'INDIVIDUAL' && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-600 mb-2">
                              Selecione os usuários ({scope.userIds?.length || 0} selecionados):
                            </p>
                            <div className="max-h-40 overflow-y-auto border rounded p-2 bg-white">
                              {allUsers.length === 0 ? (
                                <p className="text-gray-500 text-sm">Nenhum usuário encontrado</p>
                              ) : (
                                <div className="space-y-1">
                                  {allUsers.map((u) => (
                                    <label
                                      key={u.id}
                                      className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={scope.userIds?.includes(u.id) || false}
                                        onChange={() => toggleUserInScope(index, u.id)}
                                        className="rounded"
                                      />
                                      <span className="text-sm">{u.name}</span>
                                      <span className="text-xs text-gray-500">({u.profession})</span>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Criando...' : 'Criar Atribuição'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setScopes([]);
                  }}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de atribuições */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Atribuições Existentes</h2>
          </div>
          {assignments.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhuma atribuição cadastrada
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Título
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Curso
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Período
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Escopos
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assignments.map((a) => {
                  const now = new Date();
                  const dueDate = new Date(a.dueAt);
                  const isOverdue = now > dueDate;

                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <a
                          href={`/gestor/atribuicoes/${a.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {a.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{a.course.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(a.startAt).toLocaleDateString('pt-BR')} -{' '}
                        {new Date(a.dueAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {a.scopes.map((s, i) => {
                            let colorClass = 'bg-gray-100 text-gray-800';
                            let label = '';

                            switch (s.scopeType) {
                              case 'INSTITUTE_ALL':
                                colorClass = 'bg-red-100 text-red-800';
                                label = 'Todos';
                                break;
                              case 'INSTITUTE_PROFESSION':
                                colorClass = 'bg-purple-100 text-purple-800';
                                label = s.profession || 'Profissão';
                                break;
                              case 'HOSPITAL_ALL':
                                colorClass = 'bg-orange-100 text-orange-800';
                                label = `Hospital: ${hospitals.find((h) => h.id === s.hospitalId)?.name || 'Hospital'}`;
                                break;
                              case 'UNIT_ALL':
                                colorClass = 'bg-blue-100 text-blue-800';
                                label = `Unidade: ${units.find((u) => u.id === s.unitId)?.name || 'Unidade'}`;
                                break;
                              case 'UNIT_PROFESSION':
                                colorClass = 'bg-green-100 text-green-800';
                                label = `${s.profession}`;
                                break;
                              case 'INDIVIDUAL':
                                colorClass = 'bg-yellow-100 text-yellow-800';
                                label = `${s.userIds?.length || 0} usuários`;
                                break;
                            }

                            return (
                              <span
                                key={i}
                                className={`text-xs px-2 py-1 rounded ${colorClass}`}
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isOverdue ? (
                          <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                            Encerrado
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                            Em andamento
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-4 text-center">
          <a href="/gestor/rankings" className="text-blue-600 hover:underline">
            Ver Rankings →
          </a>
        </div>
      </div>
    </div>
  );
}
