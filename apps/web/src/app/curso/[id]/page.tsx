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

interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  isCompleted: boolean;
}

interface Certificate {
  id: string;
  code: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export default function CursoPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<CourseProgress | null>(null);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuingCertificate, setIssuingCertificate] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        const courseData = await api<Course>(`/courses/${courseId}`);
        setCourse(courseData);

        // Load progress
        await loadProgress(courseData);

        // Check if certificate already exists
        try {
          const certs = await api<Certificate[]>('/me/certificates');
          const existingCert = certs.find((c: any) => c.course?.id === courseId);
          if (existingCert) {
            setCertificate(existingCert);
          }
        } catch {
          // Ignore certificate check errors
        }

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

        // Load FAQs for this course
        try {
          const faqData = await api<FAQ[]>(`/courses/${courseId}/faq`);
          setFaqs(faqData);
        } catch {
          // No FAQs or error
        }
      } catch {
        router.push('/cursos');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router, courseId]);

  async function loadProgress(courseData: Course) {
    try {
      // Count total lessons
      let totalLessons = 0;
      for (const module of courseData.modules) {
        totalLessons += module._count.lessons;
      }

      // Get user's lesson approvals for this course
      // We'll check each module's lessons
      let completedLessons = 0;
      for (const module of courseData.modules) {
        const lessons = await api<Lesson[]>(`/lessons?moduleId=${module.id}`);
        for (const lesson of lessons) {
          try {
            const quizState = await api<any>(`/lessons/${lesson.id}/quiz-state`);
            if (quizState.hasPassed) {
              completedLessons++;
            }
          } catch {
            // Lesson not completed
          }
        }
      }

      setProgress({
        totalLessons,
        completedLessons,
        isCompleted: totalLessons > 0 && completedLessons === totalLessons,
      });
    } catch (err) {
      console.error('Error loading progress:', err);
    }
  }

  async function handleIssueCertificate() {
    setIssuingCertificate(true);
    try {
      const result = await api<{ certificate: Certificate; downloadUrl: string }>(`/courses/${courseId}/certificates`, {
        method: 'POST',
      });
      setCertificate(result.certificate);
      alert('Certificado emitido com sucesso!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao emitir certificado');
    } finally {
      setIssuingCertificate(false);
    }
  }

  async function handleDownloadCertificate() {
    if (!certificate) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/certificates/download/${certificate.code}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Erro ao baixar');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${certificate.code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert('Erro ao baixar certificado');
    }
  }

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

        {/* Progresso e Certificado */}
        {progress && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Seu Progresso</h3>
              <span className="text-sm text-gray-500">
                {progress.completedLessons} / {progress.totalLessons} aulas concluídas
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className={`h-3 rounded-full transition-all ${
                  progress.isCompleted ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{
                  width: `${
                    progress.totalLessons > 0
                      ? (progress.completedLessons / progress.totalLessons) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            {progress.isCompleted && (
              <div className="border-t pt-4 mt-4">
                {certificate ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🎓</span>
                      <div>
                        <p className="font-semibold text-green-800">Certificado Emitido!</p>
                        <p className="text-sm text-green-600">Código: {certificate.code}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadCertificate}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Baixar PDF
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">🏆</span>
                      <div>
                        <p className="font-semibold text-blue-800">Parabéns! Curso concluído!</p>
                        <p className="text-sm text-blue-600">Você pode emitir seu certificado.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleIssueCertificate}
                      disabled={issuingCertificate}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {issuingCertificate ? 'Emitindo...' : 'Emitir Certificado'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

        {/* FAQ Section */}
        {faqs.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Perguntas Frequentes</h2>
            <div className="space-y-2">
              {faqs.map((faq) => (
                <div
                  key={faq.id}
                  className="bg-white shadow-md rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedFaq(expandedFaq === faq.id ? null : faq.id)
                    }
                    className="w-full p-4 text-left flex justify-between items-center hover:bg-gray-50"
                  >
                    <span className="font-medium">{faq.question}</span>
                    <span className="text-gray-400">
                      {expandedFaq === faq.id ? '−' : '+'}
                    </span>
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="px-4 pb-4 text-gray-600 border-t pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
