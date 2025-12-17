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

interface InviteListItem {
  id: string;
  token: string;
  profession: string;
  systemRole: string;
  invitedEmail: string | null;
  hospital: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  status: 'valid' | 'expired' | 'used';
}

interface UserData {
  id: string;
  systemRole: string;
  instituteId: string;
}

const roleLabels: Record<string, string> = {
  ADMIN_MASTER: 'Admin Master',
  ADMIN: 'Admin',
  MANAGER: 'Gestor',
  USER: 'Usuário',
};

const statusLabels: Record<string, { label: string; className: string }> = {
  valid: { label: 'Válido', className: 'bg-green-100 text-green-800' },
  expired: { label: 'Expirado', className: 'bg-yellow-100 text-yellow-800' },
  used: { label: 'Usado', className: 'bg-gray-100 text-gray-800' },
};

export default function AdminConvitesPage() {
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
  const [invites, setInvites] = useState<InviteListItem[]>([]);

  const [formData, setFormData] = useState({
    instituteId: '',
    hospitalId: '',
    unitId: '',
    profession: '',
    invitedEmail: '',
    systemRole: 'USER',
    expiresInDays: '7',
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

        const institutesData = await api<Institute[]>('/institutes');
        setInstitutes(institutesData);

        if (userData.instituteId) {
          setFormData((prev) => ({ ...prev, instituteId: userData.instituteId }));

          const [hospitalsData, invitesData] = await Promise.all([
            api<Hospital[]>(`/hospitals?instituteId=${userData.instituteId}`),
            api<InviteListItem[]>(`/invites?instituteId=${userData.instituteId}`),
          ]);
          setHospitals(hospitalsData);
          setInvites(invitesData);
        }
      } catch {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  const handleInstituteChange = async (instituteId: string) => {
    setFormData((prev) => ({ ...prev, instituteId, hospitalId: '', unitId: '' }));
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
    setFormData((prev) => ({ ...prev, hospitalId, unitId: '' }));
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
      const body: Record<string, string | number> = {
        instituteId: formData.instituteId,
        profession: formData.profession,
        systemRole: formData.systemRole,
        expiresInDays: parseInt(formData.expiresInDays, 10),
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

      // Recarregar lista de convites
      if (user?.instituteId) {
        const invitesData = await api<InviteListItem[]>(
          `/invites?instituteId=${user.instituteId}`
        );
        setInvites(invitesData);
      }

      setFormData((prev) => ({
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
      <div className="w-full max-w-5xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Convites</h1>
          <a href="/admin" className="text-blue-600 hover:underline">
            Voltar ao painel
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Formulário */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Criar Novo Convite</h2>
            <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
                  {success}
                </div>
              )}

              {inviteLink && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-xs font-medium text-blue-800 mb-2">Link do convite:</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteLink}
                      readOnly
                      className="flex-1 px-2 py-1 text-xs bg-white border border-blue-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(inviteLink)}
                      className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="instituteId" className="block text-sm font-medium text-gray-700 mb-1">
                  Instituto *
                </label>
                <select
                  id="instituteId"
                  value={formData.instituteId}
                  onChange={(e) => handleInstituteChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

              <div className="mb-3">
                <label htmlFor="hospitalId" className="block text-sm font-medium text-gray-700 mb-1">
                  Hospital (opcional)
                </label>
                <select
                  id="hospitalId"
                  value={formData.hospitalId}
                  onChange={(e) => handleHospitalChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

              <div className="mb-3">
                <label htmlFor="unitId" className="block text-sm font-medium text-gray-700 mb-1">
                  Unidade (opcional)
                </label>
                <select
                  id="unitId"
                  value={formData.unitId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, unitId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

              <div className="mb-3">
                <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-1">
                  Profissão *
                </label>
                <select
                  id="profession"
                  value={formData.profession}
                  onChange={(e) => setFormData((prev) => ({ ...prev, profession: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

              <div className="mb-3">
                <label htmlFor="systemRole" className="block text-sm font-medium text-gray-700 mb-1">
                  Nível de Acesso *
                </label>
                <select
                  id="systemRole"
                  value={formData.systemRole}
                  onChange={(e) => setFormData((prev) => ({ ...prev, systemRole: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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

              <div className="mb-3">
                <label htmlFor="invitedEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  E-mail do convidado (opcional)
                </label>
                <input
                  type="email"
                  id="invitedEmail"
                  value={formData.invitedEmail}
                  onChange={(e) => setFormData((prev) => ({ ...prev, invitedEmail: e.target.value }))}
                  placeholder="usuario@exemplo.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="expiresInDays" className="block text-sm font-medium text-gray-700 mb-1">
                  Expira em (dias) *
                </label>
                <select
                  id="expiresInDays"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData((prev) => ({ ...prev, expiresInDays: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                >
                  <option value="1">1 dia</option>
                  <option value="3">3 dias</option>
                  <option value="7">7 dias</option>
                  <option value="14">14 dias</option>
                  <option value="30">30 dias</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {submitting ? 'Criando...' : 'Criar Convite'}
              </button>
            </form>
          </div>

          {/* Tabela de convites recentes */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Convites Recentes</h2>
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
              <div className="max-h-[600px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Profissão
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nível
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invites.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                          Nenhum convite criado ainda
                        </td>
                      </tr>
                    ) : (
                      invites.map((invite) => (
                        <tr key={invite.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{invite.profession}</div>
                            {invite.invitedEmail && (
                              <div className="text-xs text-gray-500">{invite.invitedEmail}</div>
                            )}
                            {invite.unit && (
                              <div className="text-xs text-gray-400">{invite.unit.name}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {roleLabels[invite.systemRole] || invite.systemRole}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                statusLabels[invite.status].className
                              }`}
                            >
                              {statusLabels[invite.status].label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {invite.status === 'valid' && (
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    `${window.location.origin}/invite/${invite.token}`
                                  )
                                }
                                className="text-blue-600 hover:underline text-xs"
                              >
                                Copiar link
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
