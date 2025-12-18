'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';

interface ClinicalCase {
  id: string;
  title: string;
  textAnonymized: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

interface AnonymizationResult {
  anonymizedText: string;
  findings: { type: string; count: number; matches: string[] }[];
  diffPreview: { original: string; replacement: string }[];
  hasCriticalData: boolean;
}

export default function GestorCasosPage() {
  const router = useRouter();
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCase, setEditingCase] = useState<ClinicalCase | null>(null);
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [anonymizedText, setAnonymizedText] = useState('');
  const [anonymizationResult, setAnonymizationResult] = useState<AnonymizationResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    try {
      const data = await api.get('/cases');
      setCases(data);
    } catch (err) {
      console.error('Erro ao carregar casos:', err);
    } finally {
      setLoading(false);
    }
  }

  function openNewCase() {
    setEditingCase(null);
    setTitle('');
    setRawText('');
    setAnonymizedText('');
    setAnonymizationResult(null);
    setError('');
    setShowModal(true);
  }

  function openEditCase(c: ClinicalCase) {
    setEditingCase(c);
    setTitle(c.title);
    setRawText(c.textAnonymized);
    setAnonymizedText(c.textAnonymized);
    setAnonymizationResult(null);
    setError('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Titulo e obrigatorio');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      if (editingCase) {
        await api.patch(`/cases/${editingCase.id}`, {
          title,
          textAnonymized: anonymizedText || rawText,
        });
      } else {
        await api.post('/cases', {
          title,
          textAnonymized: anonymizedText || rawText,
        });
      }
      setShowModal(false);
      loadCases();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setProcessing(false);
    }
  }

  async function handleAnonymize() {
    if (!rawText.trim()) {
      setError('Digite o texto do caso para anonimizar');
      return;
    }

    setProcessing(true);
    setError('');

    try {
      let caseId = editingCase?.id;

      // Se nao tem caso, cria um rascunho primeiro
      if (!caseId) {
        const newCase = await api.post('/cases', {
          title: title || 'Rascunho',
          textAnonymized: '',
        });
        caseId = newCase.id;
        setEditingCase(newCase);
      }

      const result = await api.post(`/cases/${caseId}/anonymize`, {
        rawText,
      });

      setAnonymizationResult(result);
      setAnonymizedText(result.anonymizedText);
    } catch (err: any) {
      setError(err.message || 'Erro ao anonimizar');
    } finally {
      setProcessing(false);
    }
  }

  async function handlePublish(caseId: string) {
    setProcessing(true);
    setError('');

    try {
      await api.patch(`/cases/${caseId}/publish`);
      loadCases();
      setShowModal(false);
    } catch (err: any) {
      if (err.findings) {
        setError(
          `Nao e possivel publicar. Dados sensiveis detectados: ${err.findings
            .map((f: any) => `${f.type} (${f.count})`)
            .join(', ')}`
        );
      } else {
        setError(err.message || 'Erro ao publicar');
      }
    } finally {
      setProcessing(false);
    }
  }

  async function handleArchive(caseId: string) {
    if (!confirm('Arquivar este caso?')) return;

    try {
      await api.patch(`/cases/${caseId}/archive`);
      loadCases();
    } catch (err: any) {
      alert(err.message || 'Erro ao arquivar');
    }
  }

  async function handleDelete(caseId: string) {
    if (!confirm('Excluir este caso permanentemente?')) return;

    try {
      await api.delete(`/cases/${caseId}`);
      loadCases();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir');
    }
  }

  const statusLabels = {
    DRAFT: { label: 'Rascunho', color: 'bg-yellow-100 text-yellow-800' },
    PUBLISHED: { label: 'Publicado', color: 'bg-green-100 text-green-800' },
    ARCHIVED: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800' },
  };

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <LoadingState message="Carregando casos clinicos..." />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Casos Clinicos</h1>
        <button
          onClick={openNewCase}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Novo Caso
        </button>
      </div>

      {cases.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Nenhum caso clinico"
          description="Crie casos clinicos anonimizados para discussao"
          action={{ label: 'Criar Caso', onClick: openNewCase }}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Titulo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Criado por
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Acoes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => openEditCase(c)}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {c.title}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        statusLabels[c.status].color
                      }`}
                    >
                      {statusLabels[c.status].label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{c.createdBy.name}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {c.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(c.id)}
                        className="text-green-600 hover:underline text-sm"
                      >
                        Publicar
                      </button>
                    )}
                    {c.status === 'PUBLISHED' && (
                      <button
                        onClick={() => handleArchive(c.id)}
                        className="text-yellow-600 hover:underline text-sm"
                      >
                        Arquivar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Edicao/Criacao */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingCase ? 'Editar Caso' : 'Novo Caso Clinico'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titulo
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Caso de Sepse em UTI"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Texto Original */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texto Original (cole aqui o caso com dados)
                  </label>
                  <textarea
                    value={rawText}
                    onChange={(e) => {
                      setRawText(e.target.value);
                      setAnonymizationResult(null);
                    }}
                    className="w-full h-64 px-3 py-2 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Cole aqui o caso clinico com dados do paciente..."
                  />
                </div>

                {/* Texto Anonimizado */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Texto Anonimizado (resultado)
                  </label>
                  <textarea
                    value={anonymizedText}
                    onChange={(e) => setAnonymizedText(e.target.value)}
                    className="w-full h-64 px-3 py-2 border rounded font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500"
                    placeholder="O texto anonimizado aparecera aqui..."
                  />
                </div>
              </div>

              {/* Botao Anonimizar */}
              <div className="mb-4">
                <button
                  onClick={handleAnonymize}
                  disabled={processing || !rawText.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {processing ? 'Processando...' : 'Anonimizar'}
                </button>
              </div>

              {/* Resultado da Anonimizacao */}
              {anonymizationResult && (
                <div className="mb-4 p-4 bg-gray-50 rounded">
                  <h3 className="font-medium mb-2">Resultado da Anonimizacao</h3>

                  {anonymizationResult.hasCriticalData && (
                    <div className="mb-2 p-2 bg-red-100 text-red-700 rounded text-sm">
                      Atencao: Dados sensiveis criticos foram detectados e substituidos
                    </div>
                  )}

                  {anonymizationResult.findings.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">Dados encontrados:</p>
                      <div className="flex flex-wrap gap-2">
                        {anonymizationResult.findings.map((f, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                          >
                            {f.type}: {f.count}x
                          </span>
                        ))}
                      </div>

                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                          Ver substituicoes ({anonymizationResult.diffPreview.length})
                        </summary>
                        <ul className="mt-2 text-sm space-y-1 max-h-40 overflow-y-auto">
                          {anonymizationResult.diffPreview.map((d, i) => (
                            <li key={i} className="font-mono">
                              <span className="text-red-600 line-through">{d.original}</span>
                              {' -> '}
                              <span className="text-green-600">{d.replacement}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  ) : (
                    <p className="text-sm text-green-600">
                      Nenhum dado sensivel encontrado
                    </p>
                  )}
                </div>
              )}

              {/* Acoes */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {processing ? 'Salvando...' : 'Salvar Rascunho'}
                </button>
                {editingCase && editingCase.status === 'DRAFT' && (
                  <button
                    onClick={() => handlePublish(editingCase.id)}
                    disabled={processing}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Publicar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
