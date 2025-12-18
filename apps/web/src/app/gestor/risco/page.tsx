'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getApiUrl, getAuthToken } from '@/lib/api';

interface RiskEntry {
  key: string;
  label: string;
  unit?: string;
  profession?: string;
  GREEN: number;
  YELLOW: number;
  ORANGE: number;
  RED: number;
  total: number;
}

interface RiskMapData {
  groupBy: string;
  entries: RiskEntry[];
  totals: {
    GREEN: number;
    YELLOW: number;
    ORANGE: number;
    RED: number;
    total: number;
  };
}

type GroupBy = 'UNIT' | 'PROFESSION' | 'UNIT_PROFESSION';

const groupByLabels: Record<GroupBy, string> = {
  UNIT: 'Por Unidade',
  PROFESSION: 'Por Profissao',
  UNIT_PROFESSION: 'Por Unidade e Profissao',
};

export default function GestorRiscoPage() {
  const router = useRouter();
  const [data, setData] = useState<RiskMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('UNIT');

  useEffect(() => {
    loadData();
  }, [groupBy]);

  async function loadData() {
    setLoading(true);
    try {
      const result = await api<RiskMapData>(`/gestor/risk-map?groupBy=${groupBy}`);
      setData(result);
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        router.push('/cursos');
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  function handleExportCSV() {
    const token = getAuthToken();
    window.open(
      `${getApiUrl()}/gestor/risk-map/export.csv?groupBy=${groupBy}&token=${token}`,
      '_blank'
    );
  }

  function getPercentage(value: number, total: number): string {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  }

  function getRiskLevel(entry: RiskEntry): string {
    const redPct = entry.total > 0 ? (entry.RED / entry.total) * 100 : 0;
    const orangePct = entry.total > 0 ? (entry.ORANGE / entry.total) * 100 : 0;
    if (redPct >= 20) return 'CRITICAL';
    if (redPct >= 10 || orangePct >= 30) return 'HIGH';
    if (redPct > 0 || orangePct >= 15) return 'MEDIUM';
    return 'LOW';
  }

  const riskLevelColors: Record<string, string> = {
    CRITICAL: 'bg-red-50 border-red-200',
    HIGH: 'bg-orange-50 border-orange-200',
    MEDIUM: 'bg-yellow-50 border-yellow-200',
    LOW: 'bg-green-50 border-green-200',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Mapa de Risco de Competencias</h1>
            <p className="text-gray-600">
              Visao agregada do estado das competencias no instituto
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Exportar CSV
            </button>
            <Link
              href="/"
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Voltar
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          {(Object.keys(groupByLabels) as GroupBy[]).map((key) => (
            <button
              key={key}
              onClick={() => setGroupBy(key)}
              className={`px-4 py-2 border-b-2 ${
                groupBy === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {groupByLabels[key]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Carregando...</p>
          </div>
        ) : !data || data.entries.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500">Nenhum dado de competencia disponivel</p>
            <p className="text-sm text-gray-400 mt-2">
              Os dados aparecerao conforme os alunos completarem aulas com competencias
            </p>
          </div>
        ) : (
          <>
            {/* Totals Summary */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow p-4 text-center">
                <p className="text-3xl font-bold">{data.totals.total}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
              <div className="bg-green-50 rounded-lg shadow p-4 text-center border border-green-200">
                <p className="text-3xl font-bold text-green-700">{data.totals.GREEN}</p>
                <p className="text-sm text-green-600">Verde</p>
                <p className="text-xs text-green-500">
                  {getPercentage(data.totals.GREEN, data.totals.total)}
                </p>
              </div>
              <div className="bg-yellow-50 rounded-lg shadow p-4 text-center border border-yellow-200">
                <p className="text-3xl font-bold text-yellow-700">{data.totals.YELLOW}</p>
                <p className="text-sm text-yellow-600">Amarelo</p>
                <p className="text-xs text-yellow-500">
                  {getPercentage(data.totals.YELLOW, data.totals.total)}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg shadow p-4 text-center border border-orange-200">
                <p className="text-3xl font-bold text-orange-700">{data.totals.ORANGE}</p>
                <p className="text-sm text-orange-600">Laranja</p>
                <p className="text-xs text-orange-500">
                  {getPercentage(data.totals.ORANGE, data.totals.total)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg shadow p-4 text-center border border-red-200">
                <p className="text-3xl font-bold text-red-700">{data.totals.RED}</p>
                <p className="text-sm text-red-600">Vermelho</p>
                <p className="text-xs text-red-500">
                  {getPercentage(data.totals.RED, data.totals.total)}
                </p>
              </div>
            </div>

            {/* Entries Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {groupBy === 'UNIT'
                        ? 'Unidade'
                        : groupBy === 'PROFESSION'
                        ? 'Profissao'
                        : 'Unidade / Profissao'}
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-green-600 uppercase">
                      Verde
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-yellow-600 uppercase">
                      Amarelo
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-orange-600 uppercase">
                      Laranja
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-red-600 uppercase">
                      Vermelho
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                      Risco
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.entries.map((entry) => {
                    const riskLevel = getRiskLevel(entry);

                    return (
                      <tr
                        key={entry.key}
                        className={`hover:bg-gray-50 ${riskLevelColors[riskLevel]}`}
                      >
                        <td className="px-6 py-4 font-medium">
                          {entry.label}
                          {groupBy === 'UNIT_PROFESSION' && entry.profession && (
                            <span className="text-sm text-gray-500 ml-2">
                              ({entry.profession})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">{entry.total}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-green-700">{entry.GREEN}</span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({getPercentage(entry.GREEN, entry.total)})
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-yellow-700">{entry.YELLOW}</span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({getPercentage(entry.YELLOW, entry.total)})
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-orange-700">{entry.ORANGE}</span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({getPercentage(entry.ORANGE, entry.total)})
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-red-700">{entry.RED}</span>
                          <span className="text-xs text-gray-400 ml-1">
                            ({getPercentage(entry.RED, entry.total)})
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              riskLevel === 'CRITICAL'
                                ? 'bg-red-200 text-red-800'
                                : riskLevel === 'HIGH'
                                ? 'bg-orange-200 text-orange-800'
                                : riskLevel === 'MEDIUM'
                                ? 'bg-yellow-200 text-yellow-800'
                                : 'bg-green-200 text-green-800'
                            }`}
                          >
                            {riskLevel === 'CRITICAL'
                              ? 'Critico'
                              : riskLevel === 'HIGH'
                              ? 'Alto'
                              : riskLevel === 'MEDIUM'
                              ? 'Medio'
                              : 'Baixo'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-6 bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-2">Legenda dos Estados</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span>Verde: Score &ge; 80%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span>Amarelo: Score 60-79%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-orange-500 rounded"></div>
                  <span>Laranja: Score 40-59%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span>Vermelho: Score &lt; 40%</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                * Os dados sao agregados e nao identificam usuarios individuais
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
