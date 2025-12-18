'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
  sortOrder: number;
}

interface Question {
  id: string;
  text: string;
  type: 'MULTIPLE_CHOICE' | 'MULTIPLE_SELECT' | 'CASE';
  justificationRequired: boolean;
  sortOrder: number;
  options: Option[];
}

interface Lesson {
  id: string;
  title: string;
}

export default function QuizEditorPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Estados para nova questão
  const [showNewQuestion, setShowNewQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<Question['type']>('MULTIPLE_CHOICE');
  const [newQuestionJustification, setNewQuestionJustification] = useState(false);

  // Estados para edição
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [lessonId]);

  async function loadData() {
    try {
      const [lessonRes, questionsRes] = await Promise.all([
        api<Lesson>(`/lessons/${lessonId}`),
        api<Question[]>(`/lessons/${lessonId}/questions`),
      ]);
      setLesson(lessonRes);
      setQuestions(questionsRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function createQuestion() {
    if (!newQuestionText.trim()) return;
    setSaving(true);
    try {
      const newQuestion = await api<Question>(`/lessons/${lessonId}/questions`, {
        method: 'POST',
        body: {
          text: newQuestionText,
          type: newQuestionType,
          justificationRequired: newQuestionJustification,
        },
      });
      setQuestions([...questions, newQuestion]);
      setNewQuestionText('');
      setNewQuestionType('MULTIPLE_CHOICE');
      setNewQuestionJustification(false);
      setShowNewQuestion(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar questão');
    } finally {
      setSaving(false);
    }
  }

  async function updateQuestion(questionId: string, data: Partial<Question>) {
    setSaving(true);
    try {
      const updated = await api<Question>(`/questions/${questionId}`, {
        method: 'PATCH',
        body: data,
      });
      setQuestions(questions.map((q) => (q.id === questionId ? { ...q, ...updated } : q)));
      setEditingQuestionId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar questão');
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm('Tem certeza que deseja excluir esta questão?')) return;
    setSaving(true);
    try {
      await api(`/questions/${questionId}`, { method: 'DELETE' });
      setQuestions(questions.filter((q) => q.id !== questionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir questão');
    } finally {
      setSaving(false);
    }
  }

  async function createOption(questionId: string) {
    const text = prompt('Texto da opção:');
    if (!text) return;
    setSaving(true);
    try {
      const newOption = await api<Option>(`/questions/${questionId}/options`, {
        method: 'POST',
        body: {
          text,
          isCorrect: false,
        },
      });
      setQuestions(
        questions.map((q) =>
          q.id === questionId ? { ...q, options: [...q.options, newOption] } : q
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar opção');
    } finally {
      setSaving(false);
    }
  }

  async function updateOption(optionId: string, questionId: string, data: Partial<Option>) {
    setSaving(true);
    try {
      const updated = await api<Option>(`/options/${optionId}`, {
        method: 'PATCH',
        body: data,
      });
      setQuestions(
        questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                options: q.options.map((o) => (o.id === optionId ? { ...o, ...updated } : o)),
              }
            : q
        )
      );
      setEditingOptionId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar opção');
    } finally {
      setSaving(false);
    }
  }

  async function deleteOption(optionId: string, questionId: string) {
    if (!confirm('Excluir esta opção?')) return;
    setSaving(true);
    try {
      await api(`/options/${optionId}`, { method: 'DELETE' });
      setQuestions(
        questions.map((q) =>
          q.id === questionId
            ? { ...q, options: q.options.filter((o) => o.id !== optionId) }
            : q
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir opção');
    } finally {
      setSaving(false);
    }
  }

  function toggleCorrect(optionId: string, questionId: string, currentValue: boolean) {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;

    // Para MULTIPLE_CHOICE e CASE, apenas uma opção pode ser correta
    if (question.type !== 'MULTIPLE_SELECT' && !currentValue) {
      // Desmarcar outras opções primeiro
      question.options.forEach((o) => {
        if (o.id !== optionId && o.isCorrect) {
          updateOption(o.id, questionId, { isCorrect: false });
        }
      });
    }

    updateOption(optionId, questionId, { isCorrect: !currentValue });
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
          <div className="flex justify-between items-start">
            <div>
              <button
                onClick={() => router.back()}
                className="text-blue-600 hover:underline mb-4 inline-block"
              >
                &larr; Voltar
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Editor de Quiz</h1>
              <p className="text-gray-600">{lesson?.title}</p>
            </div>
            <Link
              href={`/professor/aulas/${lessonId}/competencias`}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Gerenciar Competencias
            </Link>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
            <button onClick={() => setError('')} className="ml-2 font-bold">
              ×
            </button>
          </div>
        )}

        {/* Lista de questões */}
        <div className="space-y-6">
          {questions.map((question, qIndex) => (
            <div key={question.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <span className="text-sm text-gray-500">Questão {qIndex + 1}</span>
                  {editingQuestionId === question.id ? (
                    <input
                      type="text"
                      defaultValue={question.text}
                      className="w-full mt-1 px-3 py-2 border rounded"
                      onBlur={(e) => updateQuestion(question.id, { text: e.target.value })}
                      autoFocus
                    />
                  ) : (
                    <p
                      className="font-medium cursor-pointer hover:text-blue-600"
                      onClick={() => setEditingQuestionId(question.id)}
                    >
                      {question.text}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        question.type === 'MULTIPLE_CHOICE'
                          ? 'bg-blue-100 text-blue-800'
                          : question.type === 'MULTIPLE_SELECT'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {question.type === 'MULTIPLE_CHOICE'
                        ? 'Múltipla Escolha'
                        : question.type === 'MULTIPLE_SELECT'
                        ? 'Múltipla Seleção'
                        : 'Caso Clínico'}
                    </span>
                    {question.justificationRequired && (
                      <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                        Requer Justificativa
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteQuestion(question.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Excluir
                </button>
              </div>

              {/* Opções */}
              <div className="ml-4 space-y-2">
                {question.options.map((option) => (
                  <div
                    key={option.id}
                    className={`flex items-center gap-3 p-2 rounded ${
                      option.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}
                  >
                    <input
                      type={question.type === 'MULTIPLE_SELECT' ? 'checkbox' : 'radio'}
                      checked={option.isCorrect}
                      onChange={() => toggleCorrect(option.id, question.id, option.isCorrect)}
                      className="h-4 w-4"
                    />
                    {editingOptionId === option.id ? (
                      <input
                        type="text"
                        defaultValue={option.text}
                        className="flex-1 px-2 py-1 border rounded"
                        onBlur={(e) =>
                          updateOption(option.id, question.id, { text: e.target.value })
                        }
                        autoFocus
                      />
                    ) : (
                      <span
                        className="flex-1 cursor-pointer hover:text-blue-600"
                        onClick={() => setEditingOptionId(option.id)}
                      >
                        {option.text}
                      </span>
                    )}
                    <button
                      onClick={() => deleteOption(option.id, question.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => createOption(question.id)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  + Adicionar opção
                </button>
              </div>
            </div>
          ))}

          {/* Formulário nova questão */}
          {showNewQuestion ? (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-medium mb-4">Nova Questão</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Texto</label>
                  <textarea
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border rounded"
                    rows={3}
                    placeholder="Digite a pergunta..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={newQuestionType}
                    onChange={(e) => setNewQuestionType(e.target.value as Question['type'])}
                    className="mt-1 w-full px-3 py-2 border rounded"
                  >
                    <option value="MULTIPLE_CHOICE">Múltipla Escolha (1 correta)</option>
                    <option value="MULTIPLE_SELECT">Múltipla Seleção (várias corretas)</option>
                    <option value="CASE">Caso Clínico</option>
                  </select>
                </div>
                {newQuestionType === 'CASE' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="justification"
                      checked={newQuestionJustification}
                      onChange={(e) => setNewQuestionJustification(e.target.checked)}
                    />
                    <label htmlFor="justification" className="text-sm text-gray-700">
                      Exigir justificativa do aluno
                    </label>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={createQuestion}
                    disabled={saving || !newQuestionText.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Criar Questão'}
                  </button>
                  <button
                    onClick={() => setShowNewQuestion(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewQuestion(true)}
              className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500"
            >
              + Adicionar Questão
            </button>
          )}
        </div>

        {questions.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>{questions.length}</strong> questão(ões) cadastrada(s).
              Nota mínima para aprovação: <strong>70%</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
