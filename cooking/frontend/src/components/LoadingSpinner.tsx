"use client";

interface LoadingSpinnerProps {
  message: string;
}

export default function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <div className="glass rounded-2xl p-8 text-center animate-in">
      <div className="flex justify-center gap-1.5 mb-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-accent"
            style={{
              animation: "pulse-dot 1.4s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>
      <p className="text-warm-300 text-sm font-medium">{message}</p>
      <p className="text-warm-600 text-xs mt-1.5">This may take a moment</p>
    </div>
  );
}
