'use client';

interface LoadingStateProps {
  message?: string;
  variant?: 'spinner' | 'skeleton' | 'dots';
}

export default function LoadingState({
  message = 'Carregando...',
  variant = 'spinner',
}: LoadingStateProps) {
  if (variant === 'dots') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
        </div>
        {message && <p className="text-gray-500 text-sm mt-3">{message}</p>}
      </div>
    );
  }

  if (variant === 'skeleton') {
    return (
      <div className="animate-pulse space-y-4 py-4">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-32 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      {message && <p className="text-gray-500 text-sm mt-3">{message}</p>}
    </div>
  );
}
