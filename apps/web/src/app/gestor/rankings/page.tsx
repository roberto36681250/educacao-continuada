'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type RankingType = 'UNIT_ALL' | 'INSTITUTE_PROFESSION' | 'UNIT_PROFESSION';

interface RankingEntry {
  rank: number;
  userId: string;
  userName: string;
  userEmail: string;
  profession?: string;
  unitName?: string;
  hospitalName?: string;
  onTimeCount: number;
  lateCount: number;
  pendingCount: number;
  totalAssignments: number;
  score: number;
}

interface Unit {
  id: string;
  name: string;
  hospital: { id: string; name: string };
}

interface Assignment {
  id: string;
  title: string;
  courseTitle: string;
}

const PROFESSIONS = [
  'MEDICO',
  'ENFERMEIRO',
  'TECNICO_ENFERMAGEM',
  'FISIOTERAPEUTA',
  'FARMACEUTICO',
  'NUTRICIONISTA',
  'PSICOLOGO',
  'ASSISTENTE_SOCIAL',
  'FONOAUDIOLOGO',
  'TERAPEUTA_OCUPACIONAL',
  'BIOMEDICO',
  'OUTRO',
];

const PROFESSION_LABELS: Record<string, string> = {
  MEDICO: 'Médico',
  ENFERMEIRO: 'Enfermeiro',
  TECNICO_ENFERMAGEM: 'Técnico de Enfermagem',
  FISIOTERAPEUTA: 'Fisioterapeuta',
  FARMACEUTICO: 'Farmacêutico',
  NUTRICIONISTA: 'Nutricionista',
  PSICOLOGO: 'Psicólogo',
  ASSISTENTE_SOCIAL: 'Assistente Social',
  FONOAUDIOLOGO: 'Fonoaudiólogo',
  TERAPEUTA_OCUPACIONAL: 'Terapeuta Ocupacional',
  BIOMEDICO: 'Biomédico',
  OUTRO: 'Outro',
};

interface User {
  id: string;
  instituteId: string;
  role: string;
}

export default function RankingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [rankingType, setRankingType] = useState<RankingType>(
    (searchParams.get('type') as RankingType) || 'UNIT_ALL'
  );
  const [unitId, setUnitId] = useState(searchParams.get('unitId') || '');
  const [profession, setProfession] = useState(searchParams.get('profession') || '');
  const [assignmentId, setAssignmentId] = useState(searchParams.get('assignmentId') || '');
  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');

  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadFilters();
    }
  }, [user]);

  useEffect(() => {
    if (user && startDate && endDate) {
      loadRankings();
    }
  }, [user, rankingType, unitId, profession, assignmentId, startDate, endDate]);

  async function loadUser() {
    try {
      const userData = await api<User>('/auth/me');
      setUser(userData);

      // Set default dates if not set
      if (!startDate || !endDate) {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(lastDay.toISOString().split('T')[0]);
      }
    } catch (err) {
      console.error('Error loading user:', err);
      router.push('/login');
    }
  }

  async function loadFilters() {
    if (!user) return;
    try {
      const [unitsRes, assignmentsRes] = await Promise.all([
        api<Unit[]>(`/units?instituteId=${user.instituteId}`),
        api<Assignment[]>('/assignments'),
      ]);
      setUnits(unitsRes);
      setAssignments(assignmentsRes);
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  }

  async function loadRankings() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('type', rankingType);
      if (unitId) params.set('unitId', unitId);
      if (startDate) params.set('from', startDate);
      if (endDate) params.set('to', endDate);

      const result = await api<RankingEntry[]>(`/rankings?${params.toString()}`);
      setRankings(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar rankings');
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (rankings.length === 0) return;

    const headers = [
      'Posição',
      'Nome',
      'Email',
      'Profissão',
      'Unidade',
      'Hospital',
      'No Prazo',
      'Atrasadas',
      'Pendentes',
      'Total',
      'Score',
    ];

    const rows = rankings.map((r) => [
      r.rank,
      r.userName,
      r.userEmail,
      r.profession ? PROFESSION_LABELS[r.profession] || r.profession : '',
      r.unitName || '',
      r.hospitalName || '',
      r.onTimeCount,
      r.lateCount,
      r.pendingCount,
      r.totalAssignments,
      r.score.toFixed(2),
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ranking-${rankingType}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function getTabLabel(type: RankingType): string {
    switch (type) {
      case 'UNIT_ALL':
        return 'Por Unidade (Todos)';
      case 'INSTITUTE_PROFESSION':
        return 'Instituto por Profissão';
      case 'UNIT_PROFESSION':
        return 'Unidade por Profissão';
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            &larr; Voltar
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Rankings</h1>
          <p className="text-gray-600">
            Acompanhe o desempenho dos profissionais nas atribuições
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px">
              {(['UNIT_ALL', 'INSTITUTE_PROFESSION', 'UNIT_PROFESSION'] as RankingType[]).map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setRankingType(type);
                      // Reset filters when changing type
                      if (type === 'INSTITUTE_PROFESSION') {
                        setUnitId('');
                      }
                    }}
                    className={`px-6 py-4 text-sm font-medium border-b-2 ${
                      rankingType === type
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {getTabLabel(type)}
                  </button>
                )
              )}
            </nav>
          </div>

          {/* Filters */}
          <div className="p-4 border-b bg-gray-50">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Unit filter - not for INSTITUTE_PROFESSION */}
              {rankingType !== 'INSTITUTE_PROFESSION' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unidade
                  </label>
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Todas</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.hospital.name} - {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Profession filter - for INSTITUTE_PROFESSION and UNIT_PROFESSION */}
              {(rankingType === 'INSTITUTE_PROFESSION' ||
                rankingType === 'UNIT_PROFESSION') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Profissão
                  </label>
                  <select
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="w-full px-3 py-2 border rounded text-sm"
                  >
                    <option value="">Todas</option>
                    {PROFESSIONS.map((p) => (
                      <option key={p} value={p}>
                        {PROFESSION_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Assignment filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Atribuição
                </label>
                <select
                  value={assignmentId}
                  onChange={(e) => setAssignmentId(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                >
                  <option value="">Todas</option>
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Period filters */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Início
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Fim
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={exportCSV}
                disabled={rankings.length === 0}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm"
              >
                Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* Info about k=20 factor */}
        {rankingType === 'INSTITUTE_PROFESSION' && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4 text-sm">
            <strong>Nota:</strong> O ranking por profissão no instituto usa o fator k=20 para
            evitar que unidades com poucos profissionais dominem o ranking. A fórmula é:{' '}
            <code className="bg-blue-100 px-1 rounded">
              score = taxa_no_prazo × min(1, N/20)
            </code>
          </div>
        )}

        {/* Rankings table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : rankings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum resultado encontrado para os filtros selecionados.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Profissional
                  </th>
                  {rankingType !== 'INSTITUTE_PROFESSION' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Unidade
                    </th>
                  )}
                  {rankingType !== 'UNIT_ALL' && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profissão
                    </th>
                  )}
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    No Prazo
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Atrasadas
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pendentes
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rankings.map((entry) => (
                  <tr
                    key={entry.userId}
                    className={entry.rank <= 3 ? 'bg-yellow-50' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                          entry.rank === 1
                            ? 'bg-yellow-400 text-yellow-900'
                            : entry.rank === 2
                            ? 'bg-gray-300 text-gray-800'
                            : entry.rank === 3
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {entry.userName}
                      </div>
                      <div className="text-sm text-gray-500">{entry.userEmail}</div>
                    </td>
                    {rankingType !== 'INSTITUTE_PROFESSION' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.hospitalName && entry.unitName ? (
                          <>
                            <div>{entry.hospitalName}</div>
                            <div className="text-gray-400">{entry.unitName}</div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    )}
                    {rankingType !== 'UNIT_ALL' && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.profession
                          ? PROFESSION_LABELS[entry.profession] || entry.profession
                          : '-'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {entry.onTimeCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {entry.lateCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {entry.pendingCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="text-lg font-semibold text-gray-900">
                        {(entry.score * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
