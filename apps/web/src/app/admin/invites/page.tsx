'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Institute {
  id: string;
  name: string;
}

interface Hospital {
  id: string;
  name: string;
}

interface Unit {
  id: string;
  name: string;
}

interface InviteResponse {
  id: string;
  token: string;
  profession: string;
  invitedEmail: string | null;
  expiresAt: string;
}

interface UserData {
  id: string;
  systemRole: string;
  instituteId: string;
}

export default function AdminInvitesPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [formData, setFormData] = useState({
    instituteId: '',
    hospitalId: '',
    unitId: '',
    profession: '',
    invitedEmail: '',
    systemRole: 'USER',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const userData = await api<UserData>('/auth/me');
        setUser(userData);

        if (!['ADMIN_MASTER', 'ADMIN'].includes(userData.systemRole)) {
          router.push('/me');
          return;
        }

        // Carregar institutos
        const institutesData = await api<Institute[]>('/institutes');
        setInstitutes(institutesData);

        // Se o usuário tem um instituto, selecionar automaticamente
        if (userData.instituteId) {
          setFormData(prev => ({ ...prev, instituteId: userData.instituteId }));
          // Carregar hospitais do instituto
          const hospitalsData = await api<Hospital[]>(`/hospitals?instituteId=${userData.instituteId}`);
          setHospitals(hospitalsData);
        }
      } catch (err) {
        setError('Erro ao carregar dados. Faça login novamente.');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleInstituteChange = async (instituteId: string) => {
    setFormData(prev => ({ ...prev, instituteId, hospitalId: '', unitId: '' }));
    setHospitals([]);
    setUnits([]);

    if (instituteId) {
      try {
        const hospitalsData = await api<Hospital[]>(`/hospitals?instituteId=${instituteId}`);
        setHospitals(hospitalsData);
      } catch (err) {
        console.error('Erro ao carregar hospitais:', err);
      }
    }
  };

  const handleHospitalChange = async (hospitalId: string) => {
    setFormData(prev => ({ ...prev, hospitalId, unitId: '' }));
    setUnits([]);

    if (hospitalId) {
      try {
        const unitsData = await api<Unit[]>(`/units?hospitalId=${hospitalId}`);
        setUnits(unitsData);
      } catch (err) {
        console.error('Erro ao carregar unidades:', err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviteLink('');
    setSubmitting(true);

    try {
      const body: Record<string, string> = {
        instituteId: formData.instituteId,
        profession: formData.profession,
        systemRole: formData.systemRole,
      };

      if (formData.hospitalId) body.hospitalId = formData.hospitalId;
      if (formData.unitId) body.unitId = formData.unitId;
      if (formData.invitedEmail) body.invitedEmail = formData.invitedEmail;

      const invite = await api<InviteResponse>('/invites', {
        method: 'POST',
        body,
      });

      const link = `${window.location.origin}/invite/${invite.token}`;
      setInviteLink(link);
      setSuccess('Convite criado com sucesso!');

      // Limpar formulário parcialmente
      setFormData(prev => ({
        ...prev,
        profession: '',
        invitedEmail: '',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar convite');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setSuccess('Link copiado para a área de transferência!');
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
      <div className="w-full max-w-lg">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Criar Convite</h1>
          <a href="/me" className="text-blue-600 hover:underline">
            Voltar ao perfil
          </a>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-8">
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

          {inviteLink && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm font-medium text-blue-800 mb-2">Link do convite:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-white border border-blue-300 rounded"
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Copiar
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="instituteId" className="block text-sm font-medium text-gray-700 mb-1">
              Instituto *
            </label>
            <select
              id="instituteId"
              value={formData.instituteId}
              onChange={(e) => handleInstituteChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecione...</option>
              {institutes.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="hospitalId" className="block text-sm font-medium text-gray-700 mb-1">
              Hospital (opcional)
            </label>
            <select
              id="hospitalId"
              value={formData.hospitalId}
              onChange={(e) => handleHospitalChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.instituteId}
            >
              <option value="">Nenhum</option>
              {hospitals.map((hosp) => (
                <option key={hosp.id} value={hosp.id}>
                  {hosp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="unitId" className="block text-sm font-medium text-gray-700 mb-1">
              Unidade (opcional)
            </label>
            <select
              id="unitId"
              value={formData.unitId}
              onChange={(e) => setFormData(prev => ({ ...prev, unitId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!formData.hospitalId}
            >
              <option value="">Nenhuma</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-1">
              Profissão *
            </label>
            <select
              id="profession"
              value={formData.profession}
              onChange={(e) => setFormData(prev => ({ ...prev, profession: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Selecione...</option>
              <option value="Médico">Médico</option>
              <option value="Enfermeiro">Enfermeiro</option>
              <option value="Técnico de Enfermagem">Técnico de Enfermagem</option>
              <option value="Fisioterapeuta">Fisioterapeuta</option>
              <option value="Farmacêutico">Farmacêutico</option>
              <option value="Nutricionista">Nutricionista</option>
              <option value="Psicólogo">Psicólogo</option>
              <option value="Assistente Social">Assistente Social</option>
              <option value="Fonoaudiólogo">Fonoaudiólogo</option>
              <option value="Terapeuta Ocupacional">Terapeuta Ocupacional</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="systemRole" className="block text-sm font-medium text-gray-700 mb-1">
              Nível de Acesso *
            </label>
            <select
              id="systemRole"
              value={formData.systemRole}
              onChange={(e) => setFormData(prev => ({ ...prev, systemRole: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="USER">Usuário</option>
              <option value="MANAGER">Gestor</option>
              {user?.systemRole === 'ADMIN_MASTER' && (
                <>
                  <option value="ADMIN">Administrador</option>
                  <option value="ADMIN_MASTER">Administrador Master</option>
                </>
              )}
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="invitedEmail" className="block text-sm font-medium text-gray-700 mb-1">
              E-mail do convidado (opcional)
            </label>
            <input
              type="email"
              id="invitedEmail"
              value={formData.invitedEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, invitedEmail: e.target.value }))}
              placeholder="usuario@exemplo.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Se informado, o e-mail será pré-preenchido no cadastro
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Criando...' : 'Criar Convite'}
          </button>
        </form>
      </div>
    </main>
  );
}
