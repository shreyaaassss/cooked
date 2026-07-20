"use client";

interface LoadingSpinnerProps {
  message: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="relative">
          <div className="w-12 h-12 border-4 border-orange-200 rounded-full animate-spin border-t-orange-500" />
        </div>
      </div>
      <p className="text-gray-600 font-medium">{message}</p>
      <p className="text-gray-400 text-sm mt-1">
        This may take a few seconds...
      </p>
    </div>
  );
}
