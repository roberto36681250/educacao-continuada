'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  youtubeVideoId: string | null;
  durationSeconds: number;
  practicalSummary: string | null;
  tomorrowChecklist: string | null;
  status: string;
  moduleId: string;
  module: {
    id: string;
    title: string;
    course: { id: string; title: string };
  };
  quiz: { id: string; title: string; minScore: number } | null;
}

interface ReadinessReport {
  isReady: boolean;
  checklist: Array<{
    key: string;
    label: string;
    pass: boolean;
    required: boolean;
  }>;
  warnings: string[];
  checkedAt: string;
}

interface Competency {
  id: string;
  name: string;
  description: string;
}

interface LessonCompetency {
  competencyId: string;
  competency: Competency;
}

const STEPS = [
  { id: 1, name: 'Titulo', icon: '1' },
  { id: 2, name: 'Video', icon: '2' },
  { id: 3, name: 'Conteudo', icon: '3' },
  { id: 4, name: 'Quiz', icon: '4' },
  { id: 5, name: 'Competencias', icon: '5' },
  { id: 6, name: 'Publicar', icon: '6' },
];

export default function LessonWizardPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [lessonCompetencies, setLessonCompetencies] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lockError, setLockError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    youtubeVideoId: '',
    durationSeconds: 0,
    practicalSummary: '',
    tomorrowChecklist: '',
  });

  // Load lesson data
  useEffect(() => {
    loadData();
    acquireLock();

    // Renew lock every 2 minutes
    const lockInterval = setInterval(acquireLock, 2 * 60 * 1000);

    // Release lock on unmount
    return () => {
      clearInterval(lockInterval);
      releaseLock();
    };
  }, [lessonId]);

  async function acquireLock() {
    try {
      await api(`/lessons/${lessonId}/lock`, { method: 'POST' });
      setLockError('');
    } catch (err: any) {
      if (err.message?.includes('sendo editada')) {
        setLockError(err.message);
      }
    }
  }

  async function releaseLock() {
    try {
      await api(`/lessons/${lessonId}/unlock`, { method: 'POST' });
    } catch {
      // Ignore unlock errors
    }
  }

  async function loadData() {
    try {
      const [lessonData, readinessData, comps, lessonComps] = await Promise.all([
        api<Lesson>(`/lessons/${lessonId}`),
        api<ReadinessReport>(`/lessons/${lessonId}/readiness`),
        api<Competency[]>('/competencies'),
        api<LessonCompetency[]>(`/lessons/${lessonId}/competencies`).catch(() => []),
      ]);

      setLesson(lessonData);
      setReadiness(readinessData);
      setCompetencies(comps);
      setLessonCompetencies(lessonComps.map((lc) => lc.competencyId));

      setFormData({
        title: lessonData.title || '',
        description: lessonData.description || '',
        youtubeVideoId: lessonData.youtubeVideoId || '',
        durationSeconds: lessonData.durationSeconds || 0,
        practicalSummary: lessonData.practicalSummary || '',
        tomorrowChecklist: lessonData.tomorrowChecklist || '',
      });
    } catch (err) {
      setError('Erro ao carregar dados da aula');
    } finally {
      setLoading(false);
    }
  }

  async function saveAndContinue() {
    setSaving(true);
    setError('');
    try {
      await api(`/lessons/${lessonId}`, {
        method: 'PATCH',
        body: formData,
      });

      // Recompute readiness
      const readinessData = await api<ReadinessReport>(
        `/lessons/${lessonId}/recompute-readiness`,
        { method: 'POST' }
      );
      setReadiness(readinessData);

      // Reload lesson
      const lessonData = await api<Lesson>(`/lessons/${lessonId}`);
      setLesson(lessonData);

      setSuccess('Alteracoes salvas!');
      setTimeout(() => setSuccess(''), 3000);

      if (currentStep < 6) {
        setCurrentStep(currentStep + 1);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    setError('');
    try {
      await api(`/lessons/${lessonId}/publish`, { method: 'POST' });
      setSuccess('Aula publicada com sucesso!');
      setTimeout(() => {
        router.push(`/professor/cursos/${lesson?.module.course.id}`);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Erro ao publicar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCompetency(compId: string) {
    try {
      if (lessonCompetencies.includes(compId)) {
        await api(`/lessons/${lessonId}/competencies/${compId}`, { method: 'DELETE' });
        setLessonCompetencies(lessonCompetencies.filter((id) => id !== compId));
      } else {
        await api(`/lessons/${lessonId}/competencies`, {
          method: 'POST',
          body: { competencyId: compId },
        });
        setLessonCompetencies([...lessonCompetencies, compId]);
      }

      // Refresh readiness
      const readinessData = await api<ReadinessReport>(
        `/lessons/${lessonId}/recompute-readiness`,
        { method: 'POST' }
      );
      setReadiness(readinessData);
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar competencia');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  if (lockError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow max-w-md text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h2 className="text-xl font-semibold mb-2">Aula em edicao</h2>
          <p className="text-gray-600 mb-4">{lockError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <a
            href={`/professor/cursos/${lesson?.module.course.id}`}
            className="text-blue-600 hover:underline text-sm"
          >
            Voltar para o curso
          </a>
          <h1 className="text-2xl font-bold mt-2">Assistente de Aula</h1>
          <p className="text-gray-600">
            {lesson?.module.course.title} / {lesson?.module.title}
          </p>
        </div>

        {/* Steps indicator */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => setCurrentStep(step.id)}
                className={`flex flex-col items-center flex-1 ${
                  currentStep === step.id
                    ? 'text-blue-600'
                    : step.id < currentStep
                    ? 'text-green-600'
                    : 'text-gray-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mb-1 ${
                    currentStep === step.id
                      ? 'bg-blue-600 text-white'
                      : step.id < currentStep
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200'
                  }`}
                >
                  {step.id < currentStep ? '✓' : step.icon}
                </div>
                <span className="text-xs">{step.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status badges */}
        <div className="flex gap-2 mb-4">
          <span
            className={`px-3 py-1 rounded text-sm ${
              lesson?.status === 'PUBLISHED'
                ? 'bg-green-100 text-green-800'
                : lesson?.status === 'READY'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            Status: {lesson?.status}
          </span>
          {readiness?.isReady && (
            <span className="px-3 py-1 rounded text-sm bg-green-100 text-green-800">
              Pronta para publicar
            </span>
          )}
        </div>

        {/* Error/Success messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">{success}</div>
        )}

        {/* Step content */}
        <div className="bg-white rounded-lg shadow p-6">
          {/* Step 1: Title */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Passo 1: Titulo e Descricao</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titulo da Aula *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Ex: Introducao a Sepse"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descricao (opcional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows={3}
                    placeholder="Breve descricao do conteudo..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Video */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Passo 2: Video do YouTube</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID do Video do YouTube *
                  </label>
                  <input
                    type="text"
                    value={formData.youtubeVideoId}
                    onChange={(e) => setFormData({ ...formData, youtubeVideoId: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Ex: dQw4w9WgXcQ"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    O ID esta na URL do video: youtube.com/watch?v=<strong>ID_AQUI</strong>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duracao em segundos *
                  </label>
                  <input
                    type="number"
                    value={formData.durationSeconds}
                    onChange={(e) =>
                      setFormData({ ...formData, durationSeconds: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border rounded"
                    placeholder="Ex: 600 (10 minutos)"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    {Math.floor(formData.durationSeconds / 60)} min {formData.durationSeconds % 60} seg
                  </p>
                </div>
                {formData.youtubeVideoId && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                    <div className="aspect-video bg-gray-200 rounded">
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${formData.youtubeVideoId}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="rounded"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Content */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Passo 3: Conteudo Pratico</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resumo Pratico *
                  </label>
                  <textarea
                    value={formData.practicalSummary}
                    onChange={(e) => setFormData({ ...formData, practicalSummary: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                    rows={5}
                    placeholder="Pontos principais que o aluno deve lembrar..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Checklist do Plantao (Amanha) *
                  </label>
                  <textarea
                    value={formData.tomorrowChecklist}
                    onChange={(e) =>
                      setFormData({ ...formData, tomorrowChecklist: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded"
                    rows={5}
                    placeholder="- Item 1&#10;- Item 2&#10;- Item 3"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    O que o aluno deve fazer amanha no plantao apos assistir esta aula
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Quiz */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Passo 4: Quiz</h2>
              {lesson?.quiz ? (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <p className="text-green-800 font-medium">Quiz existente</p>
                    <p className="text-sm text-green-700">
                      Nota minima: {lesson.quiz.minScore}%
                    </p>
                  </div>
                  <a
                    href={`/professor/aulas/${lessonId}/quiz-editor`}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Editar Quiz
                  </a>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Checklist do Quiz:</p>
                    <ul className="space-y-1">
                      {readiness?.checklist
                        .filter((c) => c.key.startsWith('quiz'))
                        .map((item) => (
                          <li
                            key={item.key}
                            className={`text-sm flex items-center gap-2 ${
                              item.pass ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {item.pass ? '✓' : '✗'} {item.label}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-yellow-800 font-medium">Quiz nao criado</p>
                    <p className="text-sm text-yellow-700">
                      Voce precisa criar um quiz com pelo menos 5 questoes.
                    </p>
                  </div>
                  <a
                    href={`/professor/aulas/${lessonId}/quiz-editor`}
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Criar Quiz
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Competencies */}
          {currentStep === 5 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Passo 5: Competencias</h2>
              <p className="text-sm text-gray-600 mb-4">
                Vincular competencias ajuda a rastrear o progresso dos alunos. (Opcional)
              </p>
              {competencies.length === 0 ? (
                <p className="text-gray-500">Nenhuma competencia cadastrada</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {competencies.map((comp) => (
                    <label
                      key={comp.id}
                      className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={lessonCompetencies.includes(comp.id)}
                        onChange={() => toggleCompetency(comp.id)}
                        className="rounded"
                      />
                      <div>
                        <p className="font-medium">{comp.name}</p>
                        <p className="text-sm text-gray-500">{comp.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              {readiness?.warnings.length ? (
                <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
                  <p className="text-sm text-yellow-800 font-medium">Avisos:</p>
                  <ul className="text-sm text-yellow-700">
                    {readiness.warnings.map((w, i) => (
                      <li key={i}>- {w}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 6: Publish */}
          {currentStep === 6 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Passo 6: Checklist Final e Publicacao</h2>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded">
                  <p className="font-medium mb-2">Checklist de Publicacao:</p>
                  <ul className="space-y-2">
                    {readiness?.checklist.map((item) => (
                      <li
                        key={item.key}
                        className={`flex items-center gap-2 ${
                          item.pass
                            ? 'text-green-600'
                            : item.required
                            ? 'text-red-600'
                            : 'text-yellow-600'
                        }`}
                      >
                        {item.pass ? '✓' : item.required ? '✗' : '!'} {item.label}
                        {!item.required && !item.pass && (
                          <span className="text-xs">(opcional)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {readiness?.warnings.length ? (
                  <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-sm text-yellow-800 font-medium">Avisos:</p>
                    <ul className="text-sm text-yellow-700">
                      {readiness.warnings.map((w, i) => (
                        <li key={i}>- {w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex gap-4">
                  {lesson?.status === 'PUBLISHED' ? (
                    <div className="p-4 bg-green-100 rounded text-green-800">
                      Esta aula ja esta publicada!
                    </div>
                  ) : readiness?.isReady ? (
                    <button
                      onClick={handlePublish}
                      disabled={saving}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                    >
                      {saving ? 'Publicando...' : 'Publicar Aula'}
                    </button>
                  ) : (
                    <div className="p-4 bg-red-50 rounded border border-red-200">
                      <p className="text-red-800 font-medium">
                        A aula ainda nao esta pronta para publicacao.
                      </p>
                      <p className="text-sm text-red-700">
                        Complete todos os itens obrigatorios do checklist.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8 pt-4 border-t">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Anterior
            </button>
            {currentStep < 6 ? (
              <button
                onClick={saveAndContinue}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar e Continuar'}
              </button>
            ) : (
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Voltar ao inicio
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
