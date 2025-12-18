'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Competency {
  id: string;
  name: string;
  description: string | null;
}

interface LessonCompetency {
  id: string;
  competencyId: string;
  competency: Competency;
}

interface Lesson {
  id: string;
  title: string;
}

export default function AulaCompetenciasPage() {
  const router = useRouter();
  const params = useParams();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [allCompetencies, setAllCompetencies] = useState<Competency[]>([]);
  const [lessonCompetencies, setLessonCompetencies] = useState<LessonCompetency[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [lessonId]);

  async function loadData() {
    setLoading(true);
    try {
      const [lessonData, competenciesData, linkedData] = await Promise.all([
        api<Lesson>(`/lessons/${lessonId}`),
        api<Competency[]>('/competencies'),
        api<LessonCompetency[]>(`/lessons/${lessonId}/competencies`),
      ]);

      setLesson(lessonData);
      setAllCompetencies(competenciesData);
      setLessonCompetencies(linkedData);
      setSelectedIds(linkedData.map((lc) => lc.competencyId));
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        router.push('/login');
        return;
      }
      if (err.message?.includes('403') || err.message?.includes('Forbidden')) {
        router.push('/cursos');
        return;
      }
      alert(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  function toggleCompetency(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api(`/lessons/${lessonId}/competencies`, {
        method: 'POST',
        body: { competencyIds: selectedIds },
      });
      alert('Competencias atualizadas com sucesso!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar competencias');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Competencias da Aula</h1>
            <p className="text-gray-600">{lesson?.title}</p>
          </div>
          <Link
            href={`/professor/aulas/${lessonId}/quiz-editor`}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
          >
            Voltar
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Selecione as competencias associadas a esta aula
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Quando um aluno for aprovado nesta aula, serao criadas revisoes em 7, 30 e 90 dias
            para cada competencia selecionada.
          </p>

          {allCompetencies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Nenhuma competencia cadastrada no instituto</p>
              <Link
                href="/gestor/competencias"
                className="text-blue-600 hover:underline mt-2 inline-block"
              >
                Cadastrar competencias
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {allCompetencies.map((comp) => (
                <label
                  key={comp.id}
                  className={`flex items-start p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                    selectedIds.includes(comp.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(comp.id)}
                    onChange={() => toggleCompetency(comp.id)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <p className="font-medium">{comp.name}</p>
                    {comp.description && (
                      <p className="text-sm text-gray-600">{comp.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href={`/professor/aulas/${lessonId}/quiz-editor`}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancelar
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : `Salvar (${selectedIds.length} selecionadas)`}
          </button>
        </div>
      </div>
    </div>
  );
}
