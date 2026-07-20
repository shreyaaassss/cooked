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
    <div className="bg-white border-2 border-blue-300 rounded-2xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-2">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">
              Prava Payment Approval
            </h3>
            <p className="text-blue-100 text-sm">
              Approve ₹{amount.toFixed(0)} for {platformLabel}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="bg-blue-50 rounded-xl p-4 mb-6">
          <p className="text-sm text-blue-800 mb-3">
            Open the link below and tap <strong>Approve</strong> using your
            passkey (Face ID / Touch ID / Windows Hello) to authorize this
            payment.
          </p>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center py-3 px-4 bg-blue-600 text-white
                       font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            Open Prava Approval Page
          </a>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-500">
          <svg
            className="animate-spin h-5 w-5 text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Waiting for your approval...
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400">
            Your card details are handled entirely by Prava. CookCart never
            sees your card number. Prava issues a single-use, merchant-scoped
            credential that expires after this purchase.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700
                     transition-colors underline"
        >
          I&apos;ve approved the payment
        </button>
      </div>
    </div>
  );
}
