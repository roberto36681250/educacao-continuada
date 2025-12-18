'use client';

import { useState } from 'react';
import { api, apiClient } from '@/lib/api';

interface ImportValidation {
  valid: boolean;
  counts: {
    modules: number;
    lessons: number;
    quizzes: number;
    questions: number;
    options: number;
    competencies: number;
    competencyQuestionLinks: number;
    faqs: number;
  };
  warnings: string[];
  errors: string[];
}

interface ImportResult {
  success: boolean;
  courseId: string;
  importBatchId: string;
  counts: ImportValidation['counts'];
}

export default function ImportarConteudoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [payload, setPayload] = useState<any>(null);
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidation(null);
    setImportResult(null);
    setError('');

    try {
      const text = await selectedFile.text();
      const json = JSON.parse(text);
      setPayload(json);
    } catch (err) {
      setError('Arquivo JSON invalido');
      setPayload(null);
    }
  }

  async function handleAnalyze() {
    if (!payload) return;

    setLoading(true);
    setError('');

    try {
      const result = await apiClient.post<ImportValidation>('/gestor/import/course', {
        payload,
        mode: 'DRY_RUN',
      });
      setValidation(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao analisar');
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    if (!payload || !validation?.valid) return;

    if (!confirm('Tem certeza que deseja importar este curso?')) return;

    setLoading(true);
    setError('');

    try {
      const result = await apiClient.post<ImportResult>('/gestor/import/course', {
        payload,
        mode: 'APPLY',
      });
      setImportResult(result);
    } catch (err: any) {
      setError(err.message || 'Erro ao importar');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setPayload(null);
    setValidation(null);
    setImportResult(null);
    setError('');
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Importar Conteudo</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {importResult ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-xl font-bold text-green-600 mb-2">Importacao Concluida!</h2>
            <p className="text-gray-600 mb-4">
              Curso importado com sucesso (ID: {importResult.courseId})
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Batch ID: {importResult.importBatchId}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold">{importResult.counts.modules}</div>
                <div className="text-sm text-gray-500">Modulos</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold">{importResult.counts.lessons}</div>
                <div className="text-sm text-gray-500">Aulas</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold">{importResult.counts.quizzes}</div>
                <div className="text-sm text-gray-500">Quizzes</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-2xl font-bold">{importResult.counts.questions}</div>
                <div className="text-sm text-gray-500">Questoes</div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={reset}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                Importar Outro
              </button>
              <a
                href={`/gestor/cursos/${importResult.courseId}/versoes`}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ver Curso
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          {/* Step 1: Upload */}
          <div className="p-6 border-b">
            <h2 className="font-medium mb-3">1. Selecionar Arquivo JSON</h2>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {payload && (
              <div className="mt-3 p-3 bg-green-50 text-green-700 rounded text-sm">
                Arquivo carregado: {payload.course?.title || 'Curso sem titulo'}
                {payload.exportMeta && (
                  <span className="block text-xs text-gray-500">
                    Exportado em: {new Date(payload.exportMeta.exportedAt).toLocaleString('pt-BR')}
                    {' - '}Por: {payload.exportMeta.exportedBy}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Step 2: Analyze */}
          <div className="p-6 border-b">
            <h2 className="font-medium mb-3">2. Analisar Conteudo</h2>
            <button
              onClick={handleAnalyze}
              disabled={!payload || loading}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Analisando...' : 'Analisar (Dry Run)'}
            </button>

            {validation && (
              <div className="mt-4 space-y-4">
                {/* Status */}
                <div className={`p-3 rounded ${validation.valid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={validation.valid ? 'text-green-700' : 'text-red-700'}>
                    {validation.valid ? '✓ Validacao OK' : '✗ Erros encontrados'}
                  </span>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-gray-50 p-3 rounded text-center">
                    <div className="text-xl font-bold">{validation.counts.modules}</div>
                    <div className="text-xs text-gray-500">Modulos</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded text-center">
                    <div className="text-xl font-bold">{validation.counts.lessons}</div>
                    <div className="text-xs text-gray-500">Aulas</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded text-center">
                    <div className="text-xl font-bold">{validation.counts.quizzes}</div>
                    <div className="text-xs text-gray-500">Quizzes</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded text-center">
                    <div className="text-xl font-bold">{validation.counts.questions}</div>
                    <div className="text-xs text-gray-500">Questoes</div>
                  </div>
                </div>

                {/* Errors */}
                {validation.errors.length > 0 && (
                  <div className="bg-red-50 p-3 rounded">
                    <h3 className="font-medium text-red-700 mb-2">Erros ({validation.errors.length})</h3>
                    <ul className="text-sm text-red-600 space-y-1 max-h-40 overflow-y-auto">
                      {validation.errors.map((e, i) => (
                        <li key={i}>• {e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {validation.warnings.length > 0 && (
                  <div className="bg-yellow-50 p-3 rounded">
                    <h3 className="font-medium text-yellow-700 mb-2">Avisos ({validation.warnings.length})</h3>
                    <ul className="text-sm text-yellow-600 space-y-1 max-h-40 overflow-y-auto">
                      {validation.warnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Apply */}
          <div className="p-6">
            <h2 className="font-medium mb-3">3. Aplicar Importacao</h2>
            <button
              onClick={handleApply}
              disabled={!validation?.valid || loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Importando...' : 'Aplicar Importacao'}
            </button>
            {!validation?.valid && validation && (
              <p className="mt-2 text-sm text-gray-500">
                Corrija os erros acima antes de importar
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
