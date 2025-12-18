'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Certificate {
  id: string;
  code: string;
  issuedAt: string;
  course: {
    id: string;
    title: string;
  };
}

export default function CertificadosPage() {
  const router = useRouter();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCertificates();
  }, []);

  async function loadCertificates() {
    try {
      const result = await api<Certificate[]>('/me/certificates');
      setCertificates(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar certificados');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  async function downloadCertificate(code: string) {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/certificates/download/${code}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Erro ao baixar certificado');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado-${code}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao baixar certificado');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:underline mb-4 inline-block"
          >
            &larr; Voltar ao início
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Meus Certificados</h1>
          <p className="text-gray-600">
            Certificados de cursos que você concluiu
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {certificates.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-400 text-6xl mb-4">🏆</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum certificado ainda
            </h3>
            <p className="text-gray-600 mb-4">
              Complete cursos para receber seus certificados
            </p>
            <button
              onClick={() => router.push('/cursos')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Ver cursos disponíveis
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {cert.course.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Emitido em {formatDate(cert.issuedAt)}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Código: {cert.code}
                    </p>
                  </div>
                  <div className="text-green-500 text-3xl">
                    🎓
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => downloadCertificate(cert.code)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    Baixar PDF
                  </button>
                  <button
                    onClick={() => window.open(`/verify/${cert.code}`, '_blank')}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
                  >
                    Verificar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
