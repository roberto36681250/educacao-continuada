'use client';

import { useEffect, useState } from 'react';
import { api, apiClient } from '@/lib/api';
import LoadingState from '@/components/LoadingState';

interface EmailPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  digestEnabled: boolean;
  remindersEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function PreferenciasPage() {
  const [prefs, setPrefs] = useState<EmailPreference | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadPreferences();
  }, []);

  async function loadPreferences() {
    try {
      const data = await apiClient.get<EmailPreference>('/me/email-preferences');
      setPrefs(data);
    } catch (err) {
      console.error('Erro ao carregar preferencias:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(field: keyof Pick<EmailPreference, 'emailEnabled' | 'digestEnabled' | 'remindersEnabled'>) {
    if (!prefs) return;

    setSaving(true);
    setMessage('');

    try {
      const updated = await apiClient.patch<EmailPreference>('/me/email-preferences', {
        [field]: !prefs[field],
      });
      setPrefs(updated);
      setMessage('Preferencias salvas!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto p-6">
        <LoadingState message="Carregando preferencias..." />
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Preferencias de Comunicacao</h1>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}
        >
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow divide-y">
        {/* Email Global */}
        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Receber emails</h3>
            <p className="text-sm text-gray-500">
              Ativar ou desativar todos os emails da plataforma
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs?.emailEnabled ?? true}
              onChange={() => handleToggle('emailEnabled')}
              disabled={saving}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Lembretes */}
        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Lembretes de prazo</h3>
            <p className="text-sm text-gray-500">
              Receber lembretes de treinamentos proximos do prazo ou em atraso
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs?.remindersEnabled ?? true}
              onChange={() => handleToggle('remindersEnabled')}
              disabled={saving || !prefs?.emailEnabled}
              className="sr-only peer"
            />
            <div
              className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                !prefs?.emailEnabled ? 'opacity-50' : ''
              }`}
            ></div>
          </label>
        </div>

        {/* Digest */}
        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="font-medium">Resumo semanal</h3>
            <p className="text-sm text-gray-500">
              Receber um resumo semanal com metricas e pendencias (gestores)
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={prefs?.digestEnabled ?? true}
              onChange={() => handleToggle('digestEnabled')}
              disabled={saving || !prefs?.emailEnabled}
              className="sr-only peer"
            />
            <div
              className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 ${
                !prefs?.emailEnabled ? 'opacity-50' : ''
              }`}
            ></div>
          </label>
        </div>
      </div>

      {!prefs?.emailEnabled && (
        <p className="mt-4 text-sm text-yellow-600">
          Com os emails desativados, voce nao recebera nenhuma comunicacao por email.
        </p>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <p>
          Emails importantes como convites de cadastro sempre serao enviados,
          independente destas configuracoes.
        </p>
      </div>
    </main>
  );
}
