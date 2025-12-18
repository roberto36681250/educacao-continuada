'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import LoadingState from '@/components/LoadingState';

interface Course {
  id: string;
  title: string;
  status: string;
  _count: { modules: number };
}

export default function ExportarConteudoPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCourses();
  }, []);

  async function loadCourses() {
    try {
      const data = await api.get<Course[]>('/courses?includeUnpublished=true');
      setCourses(data);
    } catch (err) {
      console.error('Erro ao carregar cursos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(courseId: string, courseTitle: string) {
    setExporting(courseId);
    setError('');

    try {
      const data = await api.get<any>(`/gestor/export/course/${courseId}`);

      // Download JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `curso-${courseTitle.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Erro ao exportar');
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <LoadingState message="Carregando cursos..." />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Exportar Conteudo</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <p className="text-gray-600">
            Selecione um curso para exportar. O arquivo JSON contera todo o conteudo do curso
            (modulos, aulas, quizzes, competencias, FAQ) mas nao inclui dados de usuarios.
          </p>
        </div>

        <div className="divide-y">
          {courses.map((course) => (
            <div key={course.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
              <div>
                <h3 className="font-medium">{course.title}</h3>
                <p className="text-sm text-gray-500">
                  {course._count.modules} modulos - Status: {course.status}
                </p>
              </div>
              <button
                onClick={() => handleExport(course.id, course.title)}
                disabled={exporting === course.id}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {exporting === course.id ? 'Exportando...' : 'Exportar JSON'}
              </button>
            </div>
          ))}
        </div>

        {courses.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Nenhum curso encontrado
          </div>
        )}
      </div>
    </main>
  );
}
