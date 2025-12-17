'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  youtubeVideoId: string | null;
  durationSeconds: number;
  minWatchPercent: number;
  module: {
    id: string;
    title: string;
    course: {
      id: string;
      title: string;
    };
  };
  quiz: {
    id: string;
    title: string | null;
  } | null;
}

interface Progress {
  lessonId: string;
  watchedSeconds: number;
  watchedPct: number;
  completed: boolean;
  durationSeconds: number;
  minWatchPercent: number;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        elementId: string,
        options: {
          videoId: string;
          events: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: {
        PLAYING: number;
        PAUSED: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  getPlayerState: () => number;
  destroy: () => void;
}

export default function AulaPage() {
  const router = useRouter();
  const params = useParams();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Estado do player
  const [isPlaying, setIsPlaying] = useState(false);
  const [localWatchedSeconds, setLocalWatchedSeconds] = useState(0);
  const [quizUnlocked, setQuizUnlocked] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);
  const tickIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const saveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSecondsRef = useRef(0);

  // Carrega dados iniciais
  useEffect(() => {
    async function loadData() {
      try {
        const [lessonData, progressData] = await Promise.all([
          api<Lesson>(`/lessons/${lessonId}`),
          api<Progress>(`/lessons/${lessonId}/progress`),
        ]);

        setLesson(lessonData);
        setProgress(progressData);
        setLocalWatchedSeconds(progressData.watchedSeconds);
        setQuizUnlocked(progressData.completed);
        lastSavedSecondsRef.current = progressData.watchedSeconds;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar aula');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [lessonId]);

  // Salva progresso na API
  const saveProgress = useCallback(async (seconds: number) => {
    if (seconds <= lastSavedSecondsRef.current) return;

    try {
      const updated = await api<Progress>(`/lessons/${lessonId}/progress`, {
        method: 'POST',
        body: { watchedSeconds: seconds },
      });

      setProgress(updated);
      lastSavedSecondsRef.current = seconds;

      if (updated.completed && !quizUnlocked) {
        setQuizUnlocked(true);
      }
    } catch (err) {
      console.error('Erro ao salvar progresso:', err);
    }
  }, [lessonId, quizUnlocked]);

  // Inicializa YouTube API
  useEffect(() => {
    if (!lesson?.youtubeVideoId) return;

    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        initPlayer();
        return;
      }

      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = initPlayer;
    };

    const initPlayer = () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player('youtube-player', {
        videoId: lesson.youtubeVideoId!,
        events: {
          onStateChange: (event) => {
            const playing = event.data === window.YT.PlayerState.PLAYING;
            setIsPlaying(playing);
          },
        },
      });
    };

    loadYouTubeAPI();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [lesson?.youtubeVideoId]);

  // Tick de contagem de tempo (1 segundo)
  useEffect(() => {
    if (isPlaying && document.visibilityState === 'visible') {
      tickIntervalRef.current = setInterval(() => {
        setLocalWatchedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    }

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [isPlaying]);

  // Salva a cada 10 segundos
  useEffect(() => {
    saveIntervalRef.current = setInterval(() => {
      if (localWatchedSeconds > lastSavedSecondsRef.current) {
        saveProgress(localWatchedSeconds);
      }
    }, 10000);

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [localWatchedSeconds, saveProgress]);

  // Salva ao sair da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (localWatchedSeconds > lastSavedSecondsRef.current) {
        // Usando sendBeacon para salvar ao sair
        const data = JSON.stringify({ watchedSeconds: localWatchedSeconds });
        navigator.sendBeacon?.(
          `/api/lessons/${lessonId}/progress`,
          new Blob([data], { type: 'application/json' })
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveProgress(localWatchedSeconds);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Salva ao desmontar componente
      if (localWatchedSeconds > lastSavedSecondsRef.current) {
        saveProgress(localWatchedSeconds);
      }
    };
  }, [localWatchedSeconds, lessonId, saveProgress]);

  // Calcula porcentagem atual
  const currentPct = lesson?.durationSeconds
    ? Math.min(100, Math.floor((localWatchedSeconds / lesson.durationSeconds) * 100))
    : 0;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <p className="text-gray-600">Carregando aula...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="bg-white shadow-md rounded-lg p-6">
          <h1 className="text-xl font-bold text-red-600 mb-4">Erro</h1>
          <p className="text-gray-600">{error}</p>
          <a href="/cursos" className="text-blue-600 hover:underline mt-4 inline-block">
            Voltar aos cursos
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-8 px-6 bg-gray-900">
      <div className="w-full max-w-5xl">
        {/* Navegação */}
        <div className="mb-4">
          <a
            href={`/curso/${lesson?.module.course.id}`}
            className="text-blue-400 hover:underline text-sm"
          >
            &larr; {lesson?.module.course.title}
          </a>
          <span className="text-gray-500 mx-2">/</span>
          <span className="text-gray-400 text-sm">{lesson?.module.title}</span>
        </div>

        {/* Título */}
        <h1 className="text-2xl font-bold text-white mb-4">{lesson?.title}</h1>

        {/* Player do YouTube */}
        <div className="relative bg-black rounded-lg overflow-hidden mb-6">
          {lesson?.youtubeVideoId ? (
            <div className="aspect-video">
              <div id="youtube-player" className="w-full h-full" />
            </div>
          ) : (
            <div className="aspect-video flex items-center justify-center text-gray-400">
              Vídeo não configurado
            </div>
          )}
        </div>

        {/* Barra de progresso */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-white font-medium">Progresso da Aula</span>
            <span className="text-gray-400 text-sm">
              {formatTime(localWatchedSeconds)} / {formatTime(lesson?.durationSeconds || 0)}
            </span>
          </div>

          <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                quizUnlocked ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${currentPct}%` }}
            />
            {/* Marcador de 90% */}
            <div
              className="absolute top-0 h-full w-0.5 bg-yellow-500"
              style={{ left: `${lesson?.minWatchPercent || 90}%` }}
              title={`${lesson?.minWatchPercent || 90}% necessário para liberar o quiz`}
            />
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="text-gray-400 text-sm">
              {currentPct}% assistido
            </span>
            <span className="text-gray-400 text-sm">
              {lesson?.minWatchPercent || 90}% necessário para o quiz
            </span>
          </div>

          {isPlaying && (
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-green-500 text-sm">Contando tempo assistido...</span>
            </div>
          )}
        </div>

        {/* Descrição */}
        {lesson?.description && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6">
            <h2 className="text-white font-medium mb-2">Sobre esta aula</h2>
            <p className="text-gray-300">{lesson.description}</p>
          </div>
        )}

        {/* Botão do Quiz */}
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          {quizUnlocked ? (
            <>
              <div className="text-green-500 text-4xl mb-3">✓</div>
              <p className="text-white mb-4">
                Parabéns! Você assistiu o suficiente para fazer o quiz.
              </p>
              <a
                href={`/quiz/${lesson?.id}`}
                className="inline-block bg-green-600 text-white py-3 px-8 rounded-md hover:bg-green-700 font-medium"
              >
                Iniciar Quiz
              </a>
            </>
          ) : (
            <>
              <div className="text-gray-500 text-4xl mb-3">🔒</div>
              <p className="text-gray-400 mb-4">
                Assista pelo menos {lesson?.minWatchPercent || 90}% da aula para liberar o quiz.
              </p>
              <button
                disabled
                className="inline-block bg-gray-600 text-gray-400 py-3 px-8 rounded-md cursor-not-allowed font-medium"
              >
                Quiz Bloqueado
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
