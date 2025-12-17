'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  module: {
    id: string;
    title: string;
    course: {
      id: string;
      title: string;
    };
  };
  quiz: {
    id: string;
    title: string | null;
  } | null;
}

interface Progress {
  completed: boolean;
}

export default function QuizPage() {
  const router = useRouter();
  const params = useParams();
  const lessonId = params.lessonId as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [lessonData, progressData] = await Promise.all([
          api<Lesson>(`/lessons/${lessonId}`),
          api<Progress>(`/lessons/${lessonId}/progress`),
        ]);

        // Verificar se o aluno pode fazer o quiz
        if (!progressData.completed) {
          router.push(`/aula/${lessonId}`);
          return;
        }

        setLesson(lessonData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar quiz');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [lessonId, router]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-600">Carregando quiz...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-600 mb-4">Erro</h1>
          <p className="text-gray-600">{error}</p>
          <a href="/cursos" className="text-blue-600 hover:underline mt-4 inline-block">
            Voltar aos cursos
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-2xl">
        <div className="bg-white shadow-md rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">🚧</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Quiz em Construção</h1>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800">
              O quiz para a aula <strong>{lesson?.title}</strong> ainda está sendo desenvolvido.
            </p>
            <p className="text-yellow-700 text-sm mt-2">
              Esta funcionalidade será implementada no próximo bloco.
            </p>
          </div>

          <div className="text-left bg-gray-50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-gray-700 mb-2">Informações da Aula</h2>
            <p className="text-gray-600 text-sm">
              <strong>Curso:</strong> {lesson?.module.course.title}
            </p>
            <p className="text-gray-600 text-sm">
              <strong>Módulo:</strong> {lesson?.module.title}
            </p>
            <p className="text-gray-600 text-sm">
              <strong>Aula:</strong> {lesson?.title}
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <a
              href={`/aula/${lessonId}`}
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700"
            >
              Voltar à Aula
            </a>
            <a
              href={`/curso/${lesson?.module.course.id}`}
              className="bg-gray-300 text-gray-700 py-2 px-6 rounded-md hover:bg-gray-400"
            >
              Ver Curso
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
