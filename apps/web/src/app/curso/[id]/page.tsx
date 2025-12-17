'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Course {
  id: string;
  title: string;
  description: string | null;
  modules: Module[];
}

interface Module {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  _count: { lessons: number };
  lessons?: Lesson[];
}

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number;
  sortOrder: number;
}

interface UserData {
  id: string;
  name: string;
}

export default function CursoPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        const courseData = await api<Course>(`/courses/${courseId}`);
        setCourse(courseData);

        // Expandir primeiro módulo automaticamente
        if (courseData.modules.length > 0) {
          setExpandedModules(new Set([courseData.modules[0].id]));
          // Carregar aulas do primeiro módulo
          const lessons = await api<Lesson[]>(
            `/lessons?moduleId=${courseData.modules[0].id}`
          );
          setCourse((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              modules: prev.modules.map((m, i) =>
                i === 0 ? { ...m, lessons } : m
              ),
            };
          });
        }
      } catch {
        router.push('/cursos');
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
      const module = course?.modules.find((m) => m.id === moduleId);
      if (module && !module.lessons) {
        try {
          const lessons = await api<Lesson[]>(`/lessons?moduleId=${moduleId}`);
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

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
        <div className="mb-6">
          <a href="/cursos" className="text-blue-600 hover:underline">
            &larr; Voltar aos cursos
          </a>
        </div>

        {/* Cabeçalho do curso */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">{course?.title}</h1>
          {course?.description && (
            <p className="text-gray-600">{course.description}</p>
          )}
        </div>

        {/* Lista de módulos */}
        <h2 className="text-xl font-semibold mb-4">Conteúdo do Curso</h2>

        {course?.modules.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-6 text-center text-gray-500">
            Nenhum módulo disponível
          </div>
        ) : (
          <div className="space-y-4">
            {course?.modules.map((module, moduleIndex) => (
              <div
                key={module.id}
                className="bg-white shadow-md rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer flex justify-between items-center hover:bg-gray-50"
                  onClick={() => toggleModule(module.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">
                      {expandedModules.has(module.id) ? '▼' : '▶'}
                    </span>
                    <div>
                      <h3 className="font-semibold">
                        Módulo {moduleIndex + 1}: {module.title}
                      </h3>
                      {module.description && (
                        <p className="text-gray-600 text-sm">{module.description}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-500 text-sm">
                    {module._count.lessons} aula(s)
                  </span>
                </div>

                {expandedModules.has(module.id) && module.lessons && (
                  <div className="border-t bg-gray-50 p-4">
                    {module.lessons.length === 0 ? (
                      <p className="text-gray-500 text-sm">Nenhuma aula disponível</p>
                    ) : (
                      <ul className="space-y-2">
                        {module.lessons.map((lesson, lessonIndex) => (
                          <li key={lesson.id}>
                            <a
                              href={`/aula/${lesson.id}`}
                              className="flex justify-between items-center bg-white p-3 rounded-lg border hover:border-blue-300 hover:shadow-sm transition-all"
                            >
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium">
                                  {lessonIndex + 1}
                                </span>
                                <div>
                                  <span className="font-medium">{lesson.title}</span>
                                  {lesson.description && (
                                    <p className="text-gray-500 text-sm line-clamp-1">
                                      {lesson.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="text-gray-400 text-sm">
                                {formatDuration(lesson.durationSeconds)}
                              </span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
