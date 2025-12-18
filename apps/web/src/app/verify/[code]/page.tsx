'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface VerificationResult {
  valid: boolean;
  message?: string;
  certificate?: {
    code: string;
    userName: string;
    courseTitle: string;
    instituteName: string;
    issuedAt: string;
  };
}

export default function VerifyPage() {
  const params = useParams();
  const code = params.code as string;

  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (code) {
      verifyCertificate();
    }
  }, [code]);

  async function verifyCertificate() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/public/certificates/${code}`);
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError('Erro ao verificar certificado');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando certificado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Erro</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!result?.valid) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Certificado Inválido
          </h1>
          <p className="text-gray-600 mb-4">
            {result?.message || 'Este certificado não foi encontrado em nosso sistema.'}
          </p>
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-700">
              Código consultado: <strong>{code}</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const cert = result.certificate!;

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-bold text-green-600 mb-1">
            Certificado Válido
          </h1>
          <p className="text-gray-500 text-sm">
            Verificação realizada com sucesso
          </p>
        </div>

        <div className="border-t border-b border-gray-200 py-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Nome do Participante</p>
            <p className="text-lg font-semibold text-gray-900">{cert.userName}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Curso Concluído</p>
            <p className="text-lg font-semibold text-gray-900">{cert.courseTitle}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Instituição</p>
            <p className="text-gray-900">{cert.instituteName || 'Educação Continuada'}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Data de Emissão</p>
            <p className="text-gray-900">{formatDate(cert.issuedAt)}</p>
          </div>
        </div>

        <div className="mt-6 bg-gray-50 rounded p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">Código de Verificação</p>
          <p className="font-mono text-lg font-bold text-gray-700">{cert.code}</p>
        </div>

        <div className="mt-6 text-center text-xs text-gray-400">
          <p>Verificado em {new Date().toLocaleDateString('pt-BR')}</p>
          <p className="mt-1">Educação Continuada - Sistema de Certificação Digital</p>
        </div>
      </div>
    </div>
  );
}
