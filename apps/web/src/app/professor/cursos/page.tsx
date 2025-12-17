'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: string;
  sortOrder: number;
  createdAt: string;
  _count: {
    modules: number;
  };
}

interface UserData {
  id: string;
  systemRole: string;
  instituteId: string;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Rascunho', className: 'bg-gray-100 text-gray-800' },
  REVIEWED: { label: 'Revisado', className: 'bg-blue-100 text-blue-800' },
  APPROVED: { label: 'Aprovado', className: 'bg-yellow-100 text-yellow-800' },
  PUBLISHED: { label: 'Publicado', className: 'bg-green-100 text-green-800' },
  ARCHIVED: { label: 'Arquivado', className: 'bg-red-100 text-red-800' },
};

export default function ProfessorCursosPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'DRAFT',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        if (!['ADMIN_MASTER', 'ADMIN', 'MANAGER'].includes(userData.systemRole)) {
          router.push('/cursos');
          return;
        }

        const coursesData = await api<Course[]>(
          `/courses?instituteId=${userData.instituteId}&includeUnpublished=true`
        );
        setCourses(coursesData);
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const newCourse = await api<Course>('/courses', {
        method: 'POST',
        body: {
          title: formData.title,
          description: formData.description || undefined,
          instituteId: user.instituteId,
          status: formData.status,
        },
      });

      setCourses((prev) => [...prev, { ...newCourse, _count: { modules: 0 } }]);
      setFormData({ title: '', description: '', status: 'DRAFT' });
      setShowForm(false);
      setSuccess('Curso criado com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar curso');
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
          <h1 className="text-3xl font-bold">Cursos</h1>
          <a href="/admin" className="text-blue-600 hover:underline">
            Voltar ao painel
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

        {!showForm && (
          <button
            onClick={() => {
              setShowForm(true);
              setError('');
              setSuccess('');
            }}
            className="mb-6 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
          >
            + Novo Curso
          </button>
        )}

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Novo Curso</h2>

            <div className="mb-4">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Título *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
                minLength={3}
                maxLength={200}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Descrição
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="mb-4">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DRAFT">Rascunho</option>
                <option value="REVIEWED">Revisado</option>
                <option value="APPROVED">Aprovado</option>
                <option value="PUBLISHED">Publicado</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Criar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormData({ title: '', description: '', status: 'DRAFT' });
                }}
                className="bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.length === 0 ? (
            <div className="col-span-2 bg-white shadow-md rounded-lg p-6 text-center text-gray-500">
              Nenhum curso cadastrado
            </div>
          ) : (
            courses.map((course) => (
              <a
                key={course.id}
                href={`/professor/cursos/${course.id}`}
                className="block bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold">{course.title}</h3>
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      statusLabels[course.status]?.className || 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {statusLabels[course.status]?.label || course.status}
                  </span>
                </div>
                {course.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{course.description}</p>
                )}
                <p className="text-gray-500 text-sm">{course._count.modules} módulo(s)</p>
              </a>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
