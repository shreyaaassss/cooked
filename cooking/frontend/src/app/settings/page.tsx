"use client";

import AddressManager from "@/components/AddressManager";
import PantryManager from "@/components/PantryManager";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-1">Settings</h1>
        <p className="text-gray-500">
          Manage your delivery addresses, pantry staples, and spend preferences.
        </p>
      </div>

      <AddressManager />

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
          Orders above the auto-approve threshold need your explicit approval
          before the agent buys anything. Orders above the max spend cap are
          blocked entirely. Limits are enforced on the server.
        </p>
      </div>

      {/* Payment */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1">Payment</h3>
        <p className="text-sm text-gray-400">
          QuickPick never handles your card or UPI details. After you approve an
          order, payment is completed on the store&apos;s own checkout (Zepto
          gives a secure payment link). QuickPick only marks an order successful
          once the store confirms it.
        </p>
      </div>

      {/* Zepto / Swiggy accounts */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-1">Zepto &amp; Swiggy</h3>
        <p className="text-sm text-gray-400">
          Every QuickPick account has its own pantry, spend limits and orders, but
          they currently shop through one shared Zepto and Swiggy login, not a
          separate one per person. Letting each account connect its own Zepto/Swiggy
          would need real per-user OAuth, which isn&apos;t set up yet.
        </p>
      </div>
    </div>
  );
}
