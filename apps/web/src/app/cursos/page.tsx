'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Header from '@/components/Header';

interface Course {
  id: string;
  title: string;
  description: string | null;
  _count: {
    modules: number;
  };
}

interface UserData {
  id: string;
  name: string;
  systemRole: string;
  instituteId: string;
}

export default function CursosPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        const coursesData = await api<Course[]>(
          `/courses?instituteId=${userData.instituteId}`
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

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-600">Carregando...</p>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main className="flex min-h-screen flex-col items-center py-12 px-6 bg-gray-50">
        <div className="w-full max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Cursos Disponíveis</h1>
            <p className="text-gray-600">Olá, {user?.name}</p>
          </div>

        {courses.length === 0 ? (
          <div className="bg-white shadow-md rounded-lg p-8 text-center text-gray-500">
            Nenhum curso disponível no momento
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {courses.map((course) => (
              <a
                key={course.id}
                href={`/curso/${course.id}`}
                className="block bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow"
              >
                <h2 className="text-xl font-semibold mb-2">{course.title}</h2>
                {course.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {course.description}
                  </p>
                )}
                <p className="text-gray-500 text-sm">
                  {course._count.modules} módulo(s)
                </p>
              </a>
            ))}
          </div>
        )}
        </div>
      </main>
    </>
  );
}
