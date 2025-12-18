'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface SearchResult {
  courses: Array<{
    id: string;
    title: string;
    description: string | null;
  }>;
  lessons: Array<{
    id: string;
    title: string;
    courseId: string;
    courseTitle: string;
  }>;
  faqs: Array<{
    id: string;
    question: string;
  }>;
  competencies: Array<{
    id: string;
    name: string;
  }>;
}

export default function SearchCommand() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Flatten results for keyboard navigation
  const flatResults = results
    ? [
        ...results.courses.map((c) => ({ type: 'course' as const, ...c })),
        ...results.lessons.map((l) => ({ type: 'lesson' as const, ...l })),
        ...results.faqs.map((f) => ({ type: 'faq' as const, ...f })),
        ...results.competencies.map((c) => ({ type: 'competency' as const, ...c })),
      ]
    : [];

  // Handle Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Search with debounce
  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const data = await api<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setSelectedIndex(0);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search]);

  function handleKeyNavigation(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[selectedIndex]) {
      e.preventDefault();
      navigateToResult(flatResults[selectedIndex]);
    }
  }

  function navigateToResult(result: (typeof flatResults)[0]) {
    setIsOpen(false);
    switch (result.type) {
      case 'course':
        router.push(`/curso/${result.id}`);
        break;
      case 'lesson':
        router.push(`/aula/${result.id}`);
        break;
      case 'faq':
        router.push(`/suporte#faq-${result.id}`);
        break;
      case 'competency':
        router.push(`/revisoes`);
        break;
    }
  }

  const totalResults =
    (results?.courses.length || 0) +
    (results?.lessons.length || 0) +
    (results?.faqs.length || 0) +
    (results?.competencies.length || 0);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-200 rounded">
          Ctrl+K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white rounded-lg shadow-2xl z-50">
        {/* Search input */}
        <div className="flex items-center border-b px-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyNavigation}
            placeholder="Buscar cursos, aulas, FAQs..."
            className="flex-1 px-3 py-4 text-lg outline-none"
          />
          <kbd className="px-2 py-1 text-xs bg-gray-100 rounded text-gray-500">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="p-4 text-center text-gray-500">Buscando...</div>
          )}

          {!loading && query.length >= 2 && totalResults === 0 && (
            <div className="p-8 text-center text-gray-500">
              <p>Nenhum resultado encontrado</p>
              <p className="text-sm mt-1">Tente outros termos de busca</p>
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="p-8 text-center text-gray-400">
              <p>Digite pelo menos 2 caracteres para buscar</p>
            </div>
          )}

          {!loading && results && totalResults > 0 && (
            <div className="py-2">
              {/* Courses */}
              {results.courses.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Cursos
                  </div>
                  {results.courses.map((course, i) => {
                    const idx = i;
                    return (
                      <button
                        key={course.id}
                        onClick={() => navigateToResult({ type: 'course', ...course })}
                        className={`w-full px-4 py-2 text-left flex items-center gap-3 ${
                          selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-blue-500">📚</span>
                        <div>
                          <p className="font-medium">{course.title}</p>
                          {course.description && (
                            <p className="text-sm text-gray-500 truncate max-w-md">
                              {course.description}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Lessons */}
              {results.lessons.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Aulas
                  </div>
                  {results.lessons.map((lesson, i) => {
                    const idx = results.courses.length + i;
                    return (
                      <button
                        key={lesson.id}
                        onClick={() => navigateToResult({ type: 'lesson', ...lesson })}
                        className={`w-full px-4 py-2 text-left flex items-center gap-3 ${
                          selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-green-500">🎬</span>
                        <div>
                          <p className="font-medium">{lesson.title}</p>
                          <p className="text-sm text-gray-500">{lesson.courseTitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* FAQs */}
              {results.faqs.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Perguntas Frequentes
                  </div>
                  {results.faqs.map((faq, i) => {
                    const idx = results.courses.length + results.lessons.length + i;
                    return (
                      <button
                        key={faq.id}
                        onClick={() => navigateToResult({ type: 'faq', ...faq })}
                        className={`w-full px-4 py-2 text-left flex items-center gap-3 ${
                          selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-purple-500">❓</span>
                        <p className="font-medium">{faq.question}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Competencies */}
              {results.competencies.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                    Competencias
                  </div>
                  {results.competencies.map((comp, i) => {
                    const idx =
                      results.courses.length +
                      results.lessons.length +
                      results.faqs.length +
                      i;
                    return (
                      <button
                        key={comp.id}
                        onClick={() => navigateToResult({ type: 'competency', ...comp })}
                        className={`w-full px-4 py-2 text-left flex items-center gap-3 ${
                          selectedIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-orange-500">🎯</span>
                        <p className="font-medium">{comp.name}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 text-xs text-gray-400 flex gap-4">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>esc fechar</span>
        </div>
      </div>
    </>
  );
}
