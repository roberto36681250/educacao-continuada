'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, apiClient } from '@/lib/api';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';

interface ClinicalCase {
  id: string;
  title: string;
  textAnonymized: string;
  status: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

export default function CasosPage() {
  const [cases, setCases] = useState<ClinicalCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    try {
      const data = await apiClient.get<ClinicalCase[]>('/cases');
      // Filtra apenas PUBLISHED para alunos (API ja faz isso, mas garantimos aqui)
      setCases(data.filter((c: ClinicalCase) => c.status === 'PUBLISHED'));
    } catch (err) {
      console.error('Erro ao carregar casos:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <LoadingState message="Carregando casos clinicos..." />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Casos Clinicos</h1>

      {cases.length === 0 ? (
        <EmptyState
          icon="📋"
          title="Nenhum caso disponivel"
          description="Ainda nao ha casos clinicos publicados para estudo"
        />
      ) : (
        <div className="space-y-4">
          {cases.map((c) => (
            <Link
              key={c.id}
              href={`/casos/${c.id}`}
              className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <h2 className="text-lg font-semibold text-blue-600 mb-2">
                {c.title}
              </h2>
              <p className="text-gray-600 text-sm line-clamp-3">
                {c.textAnonymized.substring(0, 200)}
                {c.textAnonymized.length > 200 ? '...' : ''}
              </p>
              <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                <span>Por {c.createdBy.name}</span>
                <span>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
