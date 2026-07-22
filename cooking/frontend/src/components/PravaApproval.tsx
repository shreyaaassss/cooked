"use client";

interface PravaApprovalProps {
  paymentUrl: string;
  amount: number;
  platform: string;
  onComplete: () => void;
}

export default function PravaApproval({
  paymentUrl,
  amount,
  platform,
  onComplete,
}: PravaApprovalProps) {
  const platformLabel =
    platform === "zepto" ? "Zepto" : "Swiggy Instamart";

  return (
    <div
      className="glass rounded-2xl overflow-hidden"
      style={{ borderColor: "rgba(99, 102, 241, 0.18)" }}
    >
      <div
        className="px-5 py-4 bg-indigo-500/5"
        style={{ borderBottom: "1px solid rgba(255,252,248,0.04)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-indigo-400"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-warm-50">
              Payment Approval
            </h3>
            <p className="text-warm-400 text-xs">
              Approve &#8377;{amount.toFixed(0)} for {platformLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div
          className="rounded-xl p-4 mb-5 bg-indigo-500/5"
          style={{ border: "1px solid rgba(99,102,241,0.1)" }}
        >
          <p className="text-sm text-warm-300 mb-3 leading-relaxed">
            Open the link below and approve using your passkey (biometric
            authentication) to authorize this payment.
          </p>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl
                       bg-indigo-500 text-white text-sm font-semibold
                       hover:bg-indigo-600 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open Prava Approval
          </a>
        </div>

        <div className="flex items-center gap-3 text-warm-400 text-sm">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-400"
                style={{
                  animation: "pulse-dot 1.4s ease-in-out infinite",
                  animationDelay: `${i * 0.2}s`,
                }}
              />
            ))}
          </div>
          Waiting for approval...
        </div>

        <div
          className="mt-4 p-3 rounded-lg bg-white/[0.02]"
          style={{ border: "1px solid rgba(255,252,248,0.04)" }}
        >
          <div className="flex items-start gap-2">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-warm-600 mt-0.5 flex-shrink-0"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="text-[11px] text-warm-600 leading-relaxed">
              Card details are handled entirely by Prava. CookCart never sees
              your card number. Single-use, merchant-scoped credentials expire
              after this purchase.
            </p>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="mt-4 w-full py-2.5 text-xs text-warm-600 hover:text-warm-400
                     transition-colors font-medium underline underline-offset-2"
        >
          I&apos;ve approved the payment
        </button>
      </div>
    </div>
  );
}
