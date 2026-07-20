"use client";

import PantryManager from "@/components/PantryManager";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Settings</h1>
        <p className="text-gray-500">
          Manage your pantry staples and spend preferences.
        </p>
      </div>

      <PantryManager />

      {/* Spend mandate */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1">
          Spend Controls
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Set your spending limits for grocery orders.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Max spend per order
            </label>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">₹</span>
              <input
                type="number"
                defaultValue={800}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg
                           outline-none focus:border-orange-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Auto-approve under
            </label>
            <div className="flex items-center gap-1">
              <span className="text-gray-400">₹</span>
              <input
                type="number"
                defaultValue={500}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg
                           outline-none focus:border-orange-300"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          Orders above the auto-approve threshold will require explicit Passkey
          approval via Prava. Orders above the max spend cap will be blocked
          entirely.
        </p>
      </div>

      {/* Prava status */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1">
          Prava Connection
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Prava handles payment securely — your card details never touch
          CookCart.
        </p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-gray-600">
            Connected — payments will use your linked Prava wallet
          </span>
        </div>
      </div>
    </div>
  );
}
