'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import LoadingState from '@/components/LoadingState';

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

export default function CasoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<ClinicalCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCase();
  }, [params.id]);

  async function loadCase() {
    try {
      const data = await api.get(`/cases/${params.id}`);
      setCaseData(data);
    } catch (err: any) {
      setError(err.message || 'Caso nao encontrado');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <LoadingState message="Carregando caso clinico..." />
      </main>
    );
  }

  if (error || !caseData) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-red-100 text-red-700 p-4 rounded mb-4">
          {error || 'Caso nao encontrado'}
        </div>
        <Link href="/casos" className="text-blue-600 hover:underline">
          Voltar para lista de casos
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6">
      <Link
        href="/casos"
        className="text-blue-600 hover:underline text-sm mb-4 inline-block"
      >
        &larr; Voltar para casos
      </Link>

      <article className="bg-white rounded-lg shadow p-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold mb-2">{caseData.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>Por {caseData.createdBy.name}</span>
            <span>|</span>
            <span>{new Date(caseData.createdAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </header>

        <div className="prose max-w-none">
          <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
            {caseData.textAnonymized}
          </div>
        </div>

        <footer className="mt-8 pt-6 border-t">
          <div className="bg-blue-50 rounded p-4">
            <h3 className="font-medium text-blue-900 mb-2">Sobre este caso</h3>
            <p className="text-sm text-blue-800">
              Este caso clinico foi anonimizado para proteger a privacidade do paciente,
              em conformidade com a LGPD. Todos os dados identificaveis foram removidos
              ou substituidos.
            </p>
          </div>
        </footer>
      </article>
    </main>
  );
}
