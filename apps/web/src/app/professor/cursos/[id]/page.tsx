'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
  institute: { id: string; name: string };
  modules: Module[];
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sortOrder: number;
  _count?: { lessons: number };
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  youtubeVideoId: string | null;
  durationSeconds: number;
  status: string;
  sortOrder: number;
}

interface UserData {
  id: string;
  systemRole: string;
  instituteId: string;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
  READY: { label: 'Pronta', className: 'bg-blue-100 text-blue-800' },
  REVIEWED: { label: 'Revisado', className: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: 'Aprovado', className: 'bg-yellow-100 text-yellow-800' },
  PUBLISHED: { label: 'Publicado', className: 'bg-green-100 text-green-800' },
  ARCHIVED: { label: 'Arquivado', className: 'bg-red-100 text-red-800' },
};

export default function ProfessorCursoPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // States para módulos
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [moduleFormData, setModuleFormData] = useState({
    title: '',
    description: '',
    status: 'DRAFT',
  });

  // States para aulas
  const [showLessonForm, setShowLessonForm] = useState<string | null>(null);
  const [lessonFormData, setLessonFormData] = useState({
    title: '',
    description: '',
    youtubeVideoId: '',
    durationSeconds: '',
    status: 'DRAFT',
  });

  // States para edição do curso
  const [editingCourse, setEditingCourse] = useState(false);
  const [courseFormData, setCourseFormData] = useState({
    title: '',
    description: '',
    status: '',
  });

  const [submitting, setSubmitting] = useState(false);

  // States para módulos expandidos
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // States para workflow editorial
  const [duplicatingLesson, setDuplicatingLesson] = useState<string | null>(null);
  const [bulkCreating, setBulkCreating] = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState(5);

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        if (!['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userData.systemRole)) {
          router.push('/cursos');
          return;
        }

        const courseData = await api<Course>(`/courses/${courseId}`);
        setCourse(courseData);
        setCourseFormData({
          title: courseData.title,
          description: courseData.description || '',
          status: courseData.status,
        });
      } catch {
        router.push('/professor/cursos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router, courseId]);

  const toggleModule = async (moduleId: string) => {
    if (expandedModules.has(moduleId)) {
      setExpandedModules((prev) => {
        const newSet = new Set(prev);
        newSet.delete(moduleId);
        return newSet;
      });
    } else {
      // Carregar aulas do módulo se não tiver
      const module = course?.modules.find((m) => m.id === moduleId);
      if (module && !module.lessons) {
        try {
          const lessons = await api<Lesson[]>(
            `/lessons?moduleId=${moduleId}&includeUnpublished=true`
          );
          setCourse((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              modules: prev.modules.map((m) =>
                m.id === moduleId ? { ...m, lessons } : m
              ),
            };
          });
        } catch (err) {
          console.error('Erro ao carregar aulas:', err);
        }
      }
      setExpandedModules((prev) => new Set(prev).add(moduleId));
    }
  };

  const handleUpdateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const updated = await api<Course>(`/courses/${courseId}`, {
        method: 'PATCH',
        body: {
          title: courseFormData.title,
          description: courseFormData.description || undefined,
          status: courseFormData.status,
        },
      });

      setCourse((prev) => (prev ? { ...prev, ...updated } : prev));
      setEditingCourse(false);
      setSuccess('Curso atualizado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar curso');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const newModule = await api<Module>('/modules', {
        method: 'POST',
        body: {
          title: moduleFormData.title,
          description: moduleFormData.description || undefined,
          courseId,
          status: moduleFormData.status,
        },
      });

      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: [...prev.modules, { ...newModule, _count: { lessons: 0 }, lessons: [] }],
        };
      });
      setModuleFormData({ title: '', description: '', status: 'DRAFT' });
      setShowModuleForm(false);
      setSuccess('Módulo criado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar módulo');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLesson = async (e: React.FormEvent, moduleId: string) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const newLesson = await api<Lesson>('/lessons', {
        method: 'POST',
        body: {
          title: lessonFormData.title,
          description: lessonFormData.description || undefined,
          moduleId,
          youtubeVideoId: lessonFormData.youtubeVideoId || undefined,
          durationSeconds: lessonFormData.durationSeconds
            ? parseInt(lessonFormData.durationSeconds, 10)
            : 0,
          status: lessonFormData.status,
        },
      });

      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: prev.modules.map((m) =>
            m.id === moduleId
              ? { ...m, lessons: [...(m.lessons || []), newLesson] }
              : m
          ),
        };
      });
      setLessonFormData({
        title: '',
        description: '',
        youtubeVideoId: '',
        durationSeconds: '',
        status: 'DRAFT',
      });
      setShowLessonForm(null);
      setSuccess('Aula criada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar aula');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Funções de workflow editorial
  const handleDuplicateLesson = async (lessonId: string, moduleId: string) => {
    setError('');
    setDuplicatingLesson(lessonId);
    try {
      const result = await api<{ id: string; title: string }>(`/lessons/${lessonId}/duplicate`, {
        method: 'POST',
        body: { targetModuleId: moduleId },
      });
      // Adicionar a aula duplicada à lista
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: prev.modules.map((m) =>
            m.id === moduleId
              ? { ...m, lessons: [...(m.lessons || []), result as unknown as Lesson] }
              : m
          ),
        };
      });
      setSuccess('Aula duplicada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao duplicar aula');
    } finally {
      setDuplicatingLesson(null);
    }
  };

  const handleBulkCreate = async (moduleId: string) => {
    setError('');
    setBulkCreating(moduleId);
    try {
      const titles = Array.from({ length: bulkCount }, (_, i) => `Nova Aula ${i + 1}`);
      const result = await api<{ created: number; lessons: Lesson[] }>(
        `/modules/${moduleId}/lessons/bulk`,
        {
          method: 'POST',
          body: { titles },
        }
      );
      // Adicionar as aulas criadas à lista
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: prev.modules.map((m) =>
            m.id === moduleId
              ? { ...m, lessons: [...(m.lessons || []), ...result.lessons] }
              : m
          ),
        };
      });
      setSuccess(`${result.created} aulas criadas com sucesso!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar aulas em lote');
    } finally {
      setBulkCreating(null);
    }
  };

  const handlePublishLesson = async (lessonId: string) => {
    setError('');
    setSubmitting(true);
    try {
      await api(`/lessons/${lessonId}/publish`, { method: 'POST' });
      // Atualizar status da aula
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: prev.modules.map((m) => ({
            ...m,
            lessons: m.lessons?.map((l) =>
              l.id === lessonId ? { ...l, status: 'PUBLISHED' } : l
            ),
          })),
        };
      });
      setSuccess('Aula publicada com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar aula');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishModule = async (moduleId: string) => {
    setError('');
    setSubmitting(true);
    try {
      await api(`/modules/${moduleId}/publish`, { method: 'POST' });
      // Atualizar status do módulo
      setCourse((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          modules: prev.modules.map((m) =>
            m.id === moduleId ? { ...m, status: 'PUBLISHED' } : m
          ),
        };
      });
      setSuccess('Módulo publicado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar módulo');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishCourse = async () => {
    setError('');
    setSubmitting(true);
    try {
      await api(`/courses/${courseId}/publish`, { method: 'POST' });
      setCourse((prev) => (prev ? { ...prev, status: 'PUBLISHED' } : prev));
      setSuccess('Curso publicado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar curso');
    } finally {
      setSubmitting(false);
    }
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
      <div className="w-full max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <a href="/professor/cursos" className="text-blue-600 hover:underline">
            &larr; Voltar aos cursos
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

        {/* Cabeçalho do curso */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          {editingCourse ? (
            <form onSubmit={handleUpdateCourse}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título
                </label>
                <input
                  type="text"
                  value={courseFormData.title}
                  onChange={(e) =>
                    setCourseFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição
                </label>
                <textarea
                  value={courseFormData.description}
                  onChange={(e) =>
                    setCourseFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={courseFormData.status}
                  onChange={(e) =>
                    setCourseFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="REVIEWED">Revisado</option>
                  <option value="APPROVED">Aprovado</option>
                  <option value="PUBLISHED">Publicado</option>
                  <option value="ARCHIVED">Arquivado</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCourse(false)}
                  className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex justify-between items-start mb-2">
                <h1 className="text-2xl font-bold">{course?.title}</h1>
                <div className="flex gap-2 items-center">
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      statusLabels[course?.status || '']?.className || ''
                    }`}
                  >
                    {statusLabels[course?.status || '']?.label || course?.status}
                  </span>
                  {course?.status !== 'PUBLISHED' && (
                    <button
                      onClick={handlePublishCourse}
                      disabled={submitting}
                      className="bg-green-600 text-white py-1 px-3 rounded-md hover:bg-green-700 text-xs disabled:opacity-50"
                      title="Publicar curso (requer módulo publicado)"
                    >
                      Publicar Curso
                    </button>
                  )}
                  <button
                    onClick={() => setEditingCourse(true)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Editar
                  </button>
                </div>
              </div>
              {course?.description && (
                <p className="text-gray-600">{course.description}</p>
              )}
            </>
          )}
        </div>

        {/* Módulos */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Módulos</h2>
            {!showModuleForm && (
              <button
                onClick={() => setShowModuleForm(true)}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 text-sm"
              >
                + Novo Módulo
              </button>
            )}
          </div>

          {showModuleForm && (
            <form
              onSubmit={handleCreateModule}
              className="mb-4 bg-white shadow-md rounded-lg p-4"
            >
              <div className="mb-3">
                <input
                  type="text"
                  value={moduleFormData.title}
                  onChange={(e) =>
                    setModuleFormData((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Título do módulo"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div className="mb-3">
                <textarea
                  value={moduleFormData.description}
                  onChange={(e) =>
                    setModuleFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Descrição (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={2}
                />
              </div>
              <div className="mb-3">
                <select
                  value={moduleFormData.status}
                  onChange={(e) =>
                    setModuleFormData((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="DRAFT">Rascunho</option>
                  <option value="PUBLISHED">Publicado</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white py-1 px-3 rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => setShowModuleForm(false)}
                  className="bg-gray-300 text-gray-700 py-1 px-3 rounded-md hover:bg-gray-400 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {course?.modules.length === 0 ? (
            <div className="bg-white shadow-md rounded-lg p-6 text-center text-gray-500">
              Nenhum módulo cadastrado
            </div>
          ) : (
            <div className="space-y-4">
              {course?.modules.map((module) => (
                <div key={module.id} className="bg-white shadow-md rounded-lg overflow-hidden">
                  <div
                    className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50"
                    onClick={() => toggleModule(module.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">
                          {expandedModules.has(module.id) ? '▼' : '▶'}
                        </span>
                        <h3 className="font-semibold">{module.title}</h3>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            statusLabels[module.status]?.className || ''
                          }`}
                        >
                          {statusLabels[module.status]?.label || module.status}
                        </span>
                        {module.status !== 'PUBLISHED' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePublishModule(module.id);
                            }}
                            disabled={submitting}
                            className="bg-green-500 text-white py-0.5 px-2 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                            title="Publicar módulo (requer aula publicada)"
                          >
                            Publicar
                          </button>
                        )}
                      </div>
                      {module.description && (
                        <p className="text-gray-600 text-sm mt-1 ml-6">
                          {module.description}
                        </p>
                      )}
                    </div>
                    <span className="text-gray-500 text-sm">
                      {module._count?.lessons || module.lessons?.length || 0} aula(s)
                    </span>
                  </div>

                  {expandedModules.has(module.id) && (
                    <div className="border-t bg-gray-50 p-4">
                      {showLessonForm === module.id ? (
                        <form
                          onSubmit={(e) => handleCreateLesson(e, module.id)}
                          className="mb-4 bg-white p-4 rounded-lg border"
                        >
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <input
                              type="text"
                              value={lessonFormData.title}
                              onChange={(e) =>
                                setLessonFormData((prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }))
                              }
                              placeholder="Título da aula"
                              className="px-3 py-2 border border-gray-300 rounded-md"
                              required
                            />
                            <input
                              type="text"
                              value={lessonFormData.youtubeVideoId}
                              onChange={(e) =>
                                setLessonFormData((prev) => ({
                                  ...prev,
                                  youtubeVideoId: e.target.value,
                                }))
                              }
                              placeholder="ID do vídeo YouTube"
                              className="px-3 py-2 border border-gray-300 rounded-md"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <input
                              type="number"
                              value={lessonFormData.durationSeconds}
                              onChange={(e) =>
                                setLessonFormData((prev) => ({
                                  ...prev,
                                  durationSeconds: e.target.value,
                                }))
                              }
                              placeholder="Duração em segundos"
                              className="px-3 py-2 border border-gray-300 rounded-md"
                              min={0}
                            />
                            <select
                              value={lessonFormData.status}
                              onChange={(e) =>
                                setLessonFormData((prev) => ({
                                  ...prev,
                                  status: e.target.value,
                                }))
                              }
                              className="px-3 py-2 border border-gray-300 rounded-md"
                            >
                              <option value="DRAFT">Rascunho</option>
                              <option value="PUBLISHED">Publicado</option>
                            </select>
                          </div>
                          <div className="mb-3">
                            <textarea
                              value={lessonFormData.description}
                              onChange={(e) =>
                                setLessonFormData((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              placeholder="Descrição (opcional)"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              rows={2}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              disabled={submitting}
                              className="bg-green-600 text-white py-1 px-3 rounded-md hover:bg-green-700 text-sm disabled:opacity-50"
                            >
                              Criar Aula
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowLessonForm(null)}
                              className="bg-gray-300 text-gray-700 py-1 px-3 rounded-md hover:bg-gray-400 text-sm"
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex gap-4 mb-4 flex-wrap items-center">
                          <button
                            onClick={() => setShowLessonForm(module.id)}
                            className="text-green-600 hover:underline text-sm"
                          >
                            + Nova Aula
                          </button>
                          {bulkCreating === module.id ? (
                            <div className="flex gap-2 items-center">
                              <input
                                type="number"
                                value={bulkCount}
                                onChange={(e) => setBulkCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                                min={1}
                                max={20}
                              />
                              <button
                                onClick={() => handleBulkCreate(module.id)}
                                disabled={submitting}
                                className="bg-blue-600 text-white py-1 px-3 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                              >
                                Criar
                              </button>
                              <button
                                onClick={() => setBulkCreating(null)}
                                className="text-gray-500 hover:text-gray-700 text-sm"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setBulkCreating(module.id)}
                              className="text-blue-600 hover:underline text-sm"
                            >
                              + Criar Aulas em Lote
                            </button>
                          )}
                        </div>
                      )}

                      {module.lessons && module.lessons.length > 0 ? (
                        <ul className="space-y-2">
                          {module.lessons.map((lesson, index) => (
                            <li
                              key={lesson.id}
                              className="flex justify-between items-center bg-white p-3 rounded-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400 text-sm">{index + 1}.</span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{lesson.title}</span>
                                    <span
                                      className={`px-2 py-0.5 text-xs rounded-full ${
                                        statusLabels[lesson.status]?.className || ''
                                      }`}
                                    >
                                      {statusLabels[lesson.status]?.label || lesson.status}
                                    </span>
                                  </div>
                                  {lesson.youtubeVideoId && (
                                    <span className="text-gray-500 text-xs">
                                      YouTube: {lesson.youtubeVideoId} |{' '}
                                      {formatDuration(lesson.durationSeconds)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 items-center flex-wrap">
                                <a
                                  href={`/professor/aulas/${lesson.id}/wizard`}
                                  className="bg-indigo-100 text-indigo-700 py-0.5 px-2 rounded text-xs hover:bg-indigo-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Wizard
                                </a>
                                <a
                                  href={`/professor/aulas/${lesson.id}/quiz-editor`}
                                  className="text-purple-600 hover:underline text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Quiz
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateLesson(lesson.id, module.id);
                                  }}
                                  disabled={duplicatingLesson === lesson.id}
                                  className="text-orange-600 hover:underline text-sm disabled:opacity-50"
                                >
                                  {duplicatingLesson === lesson.id ? 'Duplicando...' : 'Duplicar'}
                                </button>
                                {lesson.status === 'READY' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePublishLesson(lesson.id);
                                    }}
                                    disabled={submitting}
                                    className="bg-green-500 text-white py-0.5 px-2 rounded text-xs hover:bg-green-600 disabled:opacity-50"
                                  >
                                    Publicar
                                  </button>
                                )}
                                <a
                                  href={`/aula/${lesson.id}`}
                                  className="text-blue-600 hover:underline text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Ver
                                </a>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 text-sm">Nenhuma aula neste módulo</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
