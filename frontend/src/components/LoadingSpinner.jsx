import { Cloud } from 'lucide-react';

function LoadingSpinner({ message }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[200px]">
      <div className="relative">
        <Cloud className="w-12 h-12 text-brand-500 animate-pulse-slow" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      </div>
      {message && <p className="mt-4 text-gray-500">{message}</p>}
    </div>
  );
}

export default LoadingSpinner;
