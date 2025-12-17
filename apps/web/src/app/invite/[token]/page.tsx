'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api, setToken } from '@/lib/api';

interface InviteData {
  id: string;
  token: string;
  profession: string;
  invitedEmail: string | null;
  expiresAt: string;
  institute: { id: string; name: string };
  hospital: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
}

interface AcceptResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    professionalRegister: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    async function fetchInvite() {
      try {
        const data = await api<InviteData>(`/invites/${token}`);
        setInvite(data);
        if (data.invitedEmail) {
          setFormData((prev) => ({ ...prev, email: data.invitedEmail! }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Convite inválido ou expirado');
      } finally {
        setLoading(false);
      }
    }
    fetchInvite();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (formData.cpf.length !== 11 || !/^\d+$/.test(formData.cpf)) {
      setError('CPF deve conter exatamente 11 dígitos numéricos');
      return;
    }

    setSubmitting(true);

    try {
      const data = await api<AcceptResponse>(`/invites/${token}/accept`, {
        method: 'POST',
        body: {
          name: formData.name,
          email: formData.email,
          cpf: formData.cpf,
          phone: formData.phone,
          professionalRegister: formData.professionalRegister,
          password: formData.password,
        },
      });

      setToken(data.accessToken);
      router.push('/me');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-600">Carregando convite...</p>
      </main>
    );
  }

  if (error && !invite) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md bg-white shadow-md rounded-lg p-8">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Convite Inválido</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/login" className="text-blue-600 hover:underline">
            Ir para login
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-2">Educação Continuada</h1>
        <p className="text-center text-gray-600 mb-8">Complete seu cadastro</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <h2 className="font-semibold text-blue-800 mb-2">Dados do Convite</h2>
          <p className="text-sm text-blue-700">
            <strong>Instituto:</strong> {invite?.institute.name}
          </p>
          {invite?.hospital && (
            <p className="text-sm text-blue-700">
              <strong>Hospital:</strong> {invite.hospital.name}
            </p>
          )}
          {invite?.unit && (
            <p className="text-sm text-blue-700">
              <strong>Unidade:</strong> {invite.unit.name}
            </p>
          )}
          <p className="text-sm text-blue-700">
            <strong>Profissão:</strong> {invite?.profession}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome completo *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              E-mail *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              readOnly={!!invite?.invitedEmail}
            />
          </div>

          <div className="mb-4">
            <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
              CPF * (apenas números)
            </label>
            <input
              type="text"
              id="cpf"
              name="cpf"
              value={formData.cpf}
              onChange={handleChange}
              placeholder="12345678901"
              maxLength={11}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefone *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="11999999999"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="professionalRegister" className="block text-sm font-medium text-gray-700 mb-1">
              Registro Profissional *
            </label>
            <input
              type="text"
              id="professionalRegister"
              name="professionalRegister"
              value={formData.professionalRegister}
              onChange={handleChange}
              placeholder="COREN-SP 123456"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Senha * (mín. 6 caracteres)
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              minLength={6}
            />
          </div>

          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar Senha *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Criando conta...' : 'Criar conta'}
          </button>
        </form>
      </div>
    </main>
  );
}
