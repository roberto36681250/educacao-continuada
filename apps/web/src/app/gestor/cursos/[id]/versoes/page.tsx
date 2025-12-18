'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api, apiClient } from '@/lib/api';
import LoadingState from '@/components/LoadingState';

interface CourseVersion {
  id: string;
  versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt: string | null;
  createdAt: string;
  createdByUserId: string;
}

interface VersionsData {
  courseId: string;
  currentDraftVersionId: string | null;
  currentPublishedVersionId: string | null;
  versions: CourseVersion[];
}

interface CourseData {
  id: string;
  title: string;
  status: string;
}

export default function CursoVersoesPage() {
  const params = useParams();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseData | null>(null);
  const [versionsData, setVersionsData] = useState<VersionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [courseId]);

  async function loadData() {
    try {
      const [courseData, versionsResult] = await Promise.all([
        apiClient.get<CourseData>(`/courses/${courseId}`),
        apiClient.get<VersionsData>(`/courses/${courseId}/versions`),
      ]);
      setCourse(courseData);
      setVersionsData(versionsResult);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    if (!confirm('Publicar este curso? Uma nova versao DRAFT sera criada para edicoes futuras.')) {
      return;
    }

    setPublishing(true);
    setError('');

    try {
      await apiClient.patch(`/courses/${courseId}/publish`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Erro ao publicar');
    } finally {
      setPublishing(false);
    }
  }

  const statusLabels = {
    DRAFT: { label: 'Rascunho', color: 'bg-yellow-100 text-yellow-800' },
    PUBLISHED: { label: 'Publicado', color: 'bg-green-100 text-green-800' },
    ARCHIVED: { label: 'Arquivado', color: 'bg-gray-100 text-gray-800' },
  };

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <LoadingState message="Carregando versoes..." />
      </main>
    );
  }

  if (!course || !versionsData) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="text-center text-red-600">Curso nao encontrado</div>
      </main>
    );
  }

  const canPublish = versionsData.versions.some(
    (v) => v.status === 'DRAFT' && v.id === versionsData.currentDraftVersionId
  );

  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{course.title}</h1>
          <p className="text-gray-600">Historico de Versoes</p>
        </div>

        {canPublish && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {publishing ? 'Publicando...' : 'Publicar Versao Atual'}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Status Atual */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <h2 className="font-medium mb-3">Status Atual</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-500 mb-1">Versao Publicada</div>
            {versionsData.currentPublishedVersionId ? (
              <span className="font-medium text-green-600">
                v{versionsData.versions.find(v => v.id === versionsData.currentPublishedVersionId)?.versionNumber}
              </span>
            ) : (
              <span className="text-gray-400">Nenhuma</span>
            )}
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="text-sm text-gray-500 mb-1">Versao em Edicao</div>
            {versionsData.currentDraftVersionId ? (
              <span className="font-medium text-yellow-600">
                v{versionsData.versions.find(v => v.id === versionsData.currentDraftVersionId)?.versionNumber}
              </span>
            ) : (
              <span className="text-gray-400">Nenhuma</span>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Versoes */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Versao
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Data de Publicacao
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Criada em
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {versionsData.versions.map((version) => (
              <tr
                key={version.id}
                className={`hover:bg-gray-50 ${
                  version.id === versionsData.currentPublishedVersionId
                    ? 'bg-green-50'
                    : version.id === versionsData.currentDraftVersionId
                    ? 'bg-yellow-50'
                    : ''
                }`}
              >
                <td className="px-6 py-4 font-medium">
                  v{version.versionNumber}
                  {version.id === versionsData.currentPublishedVersionId && (
                    <span className="ml-2 text-xs text-green-600">(atual)</span>
                  )}
                  {version.id === versionsData.currentDraftVersionId && (
                    <span className="ml-2 text-xs text-yellow-600">(em edicao)</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      statusLabels[version.status].color
                    }`}
                  >
                    {statusLabels[version.status].label}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {version.publishedAt
                    ? new Date(version.publishedAt).toLocaleString('pt-BR')
                    : '-'}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {new Date(version.createdAt).toLocaleString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {versionsData.versions.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Nenhuma versao encontrada
          </div>
        )}
      </div>
    </main>
  );
}
