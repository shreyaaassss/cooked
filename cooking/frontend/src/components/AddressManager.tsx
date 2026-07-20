"use client";

import { useEffect, useState } from "react";
import {
  getZeptoAddresses,
  selectZeptoAddress,
  addZeptoAddress,
  getSwiggyAddresses,
} from "@/lib/api";

interface Address {
  id?: string;
  addressId?: string;
  name?: string;
  type?: string;
  formattedAddress?: string;
  shortAddress?: string;
  address?: string;
  addressLine?: string;
  addressTag?: string;
  addressCategory?: string;
  [key: string]: unknown;
}

export default function AddressManager() {
  const [zeptoAddresses, setZeptoAddresses] = useState<Address[]>([]);
  const [swiggyAddresses, setSwiggyAddresses] = useState<Address[]>([]);
  const [selectedZepto, setSelectedZepto] = useState<string | null>(null);
  const [selectedSwiggy, setSelectedSwiggy] = useState<string | null>(null);
  const [loadingZ, setLoadingZ] = useState(true);
  const [loadingS, setLoadingS] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    type: "HOME",
    name: "Home",
    flat_details: "",
    building_name: "",
    landmark: "",
    latitude: "",
    longitude: "",
    formatted_address: "",
    short_address: "",
    contact_name: "",
    contact_number: "",
  });

  useEffect(() => {
    loadAddresses();
  }, []);

  async function loadAddresses() {
    setError(null);
    setLoadingZ(true);
    setLoadingS(true);

    try {
      const z = await getZeptoAddresses();
      setZeptoAddresses(z.addresses || []);
    } catch {
      // Zepto not authenticated yet
    } finally {
      setLoadingZ(false);
    }

    try {
      const s = await getSwiggyAddresses();
      setSwiggyAddresses(s.addresses || []);
    } catch {
      // Swiggy not authenticated yet
    } finally {
      setLoadingS(false);
    }
  }

  async function handleSelectZepto(id: string) {
    try {
      await selectZeptoAddress(id);
      setSelectedZepto(id);
      setSuccessMsg("Zepto delivery address selected!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError("Failed to select Zepto address");
    }
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
      },
      () => setError("Unable to get location. Please enter coordinates manually.")
    );
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!form.flat_details || !form.building_name || !form.latitude || !form.longitude) {
      setError("Please fill all required fields");
      return;
    }
    setAddingAddress(true);
    setError(null);
    try {
      await addZeptoAddress({
        type: form.type,
        name: form.name,
        flat_details: form.flat_details,
        building_name: form.building_name,
        landmark: form.landmark,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        formatted_address:
          form.formatted_address ||
          `${form.flat_details}, ${form.building_name}, ${form.short_address}`,
        short_address: form.short_address,
        contact_name: form.contact_name,
        contact_number: form.contact_number,
      });
      setShowAddForm(false);
      setForm({
        type: "HOME", name: "Home", flat_details: "", building_name: "",
        landmark: "", latitude: "", longitude: "", formatted_address: "",
        short_address: "", contact_name: "", contact_number: "",
      });
      setSuccessMsg("Address saved successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add address");
    } finally {
      setAddingAddress(false);
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-1">
        Delivery Addresses
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Select or add delivery addresses. Both platforms need an address to
        search and deliver products.
      </p>

      {/* Alerts */}
      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 flex justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold ml-2">&times;</button>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 px-4 py-2.5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* ── Zepto ── */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-purple-500 rounded-full" />
            Zepto Addresses
          </h4>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg
                       hover:bg-purple-100 transition-colors font-medium border border-purple-200"
          >
            {showAddForm ? "Cancel" : "+ Add New"}
          </button>
        </div>

        {loadingZ ? (
          <p className="text-sm text-gray-400 py-3">Loading...</p>
        ) : zeptoAddresses.length === 0 ? (
          <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
            No saved Zepto addresses. Click &quot;+ Add New&quot; above to add one.
          </div>
        ) : (
          <div className="space-y-2">
            {zeptoAddresses.map((addr) => {
              const id = (addr.id || addr.addressId || "") as string;
              const selected = selectedZepto === id;
              return (
                <div
                  key={id}
                  onClick={() => handleSelectZepto(id)}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-purple-600 uppercase">
                          {(addr.type as string) || (addr.name as string) || "Address"}
                        </span>
                        {selected && (
                          <span className="text-[10px] bg-purple-500 text-white px-2 py-0.5 rounded-full">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 leading-snug">
                        {(addr.formattedAddress as string) ||
                          (addr.shortAddress as string) ||
                          (addr.name as string) ||
                          id}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                      selected ? "border-purple-500 bg-purple-500" : "border-gray-300"
                    }`}>
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add address form */}
        {showAddForm && (
          <form onSubmit={handleAddAddress} className="mt-4 p-5 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
            <h5 className="font-semibold text-gray-700 text-sm">Add New Zepto Address</h5>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-400 bg-white">
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Label">
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="My Home" className="input-field" />
              </Field>
            </div>

            <Field label="Flat / House No. *">
              <input type="text" value={form.flat_details} onChange={(e) => setForm({ ...form, flat_details: e.target.value })}
                placeholder="A-101, 3rd Floor" required className="input-field" />
            </Field>

            <Field label="Building / Society *">
              <input type="text" value={form.building_name} onChange={(e) => setForm({ ...form, building_name: e.target.value })}
                placeholder="Sunrise Apartments" required className="input-field" />
            </Field>

            <Field label="Landmark (optional)">
              <input type="text" value={form.landmark} onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                placeholder="Near City Mall" className="input-field" />
            </Field>

            <Field label="Area / City *">
              <input type="text" value={form.short_address} onChange={(e) => setForm({ ...form, short_address: e.target.value })}
                placeholder="Kothrud, Pune" required className="input-field" />
            </Field>

            <Field label="Full Address (auto-filled if left blank)">
              <input type="text" value={form.formatted_address} onChange={(e) => setForm({ ...form, formatted_address: e.target.value })}
                placeholder="A-101, Sunrise Apartments, Kothrud, Pune 411038" className="input-field" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude *">
                <input type="text" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="18.5089" required className="input-field" />
              </Field>
              <Field label="Longitude *">
                <input type="text" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="73.9260" required className="input-field" />
              </Field>
            </div>

            <button type="button" onClick={handleLocate}
              className="w-full text-sm text-purple-600 hover:text-purple-700 py-2.5
                         border border-dashed border-purple-300 rounded-xl
                         hover:bg-purple-50 transition-colors font-medium">
              Use my current location
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact Name">
                <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Shreyas" className="input-field" />
              </Field>
              <Field label="Phone Number">
                <input type="text" value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })}
                  placeholder="+91 9876543210" className="input-field" />
              </Field>
            </div>

            <button type="submit" disabled={addingAddress}
              className="w-full px-4 py-3 bg-purple-500 text-white text-sm font-semibold
                         rounded-xl hover:bg-purple-600 transition-colors disabled:opacity-50">
              {addingAddress ? "Saving..." : "Save Address"}
            </button>
          </form>
        )}
      </section>

      {/* ── Swiggy ── */}
      <section>
        <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 bg-orange-500 rounded-full" />
          Swiggy Instamart Addresses
        </h4>
        <p className="text-xs text-gray-400 mb-3">
          Swiggy addresses are synced from your Swiggy account. Manage them in the Swiggy app.
        </p>

        {loadingS ? (
          <p className="text-sm text-gray-400 py-3">Loading...</p>
        ) : swiggyAddresses.length === 0 ? (
          <div className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4 text-center">
            No Swiggy addresses found. Add addresses in the Swiggy app.
          </div>
        ) : (
          <div className="space-y-2">
            {swiggyAddresses.map((addr, idx) => {
              const id = (addr.id || addr.addressId || String(idx)) as string;
              const selected = selectedSwiggy === id;
              const tag = (addr.addressTag || addr.addressCategory || addr.type || "") as string;
              const line = (addr.addressLine || addr.formattedAddress || addr.address || "") as string;
              return (
                <div
                  key={id}
                  onClick={() => setSelectedSwiggy(id)}
                  className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-orange-500 bg-orange-50"
                      : "border-gray-200 hover:border-orange-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {tag && (
                          <span className="text-xs font-bold text-orange-600 uppercase">
                            {tag}
                          </span>
                        )}
                        {selected && (
                          <span className="text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 leading-snug">{line}</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                      selected ? "border-orange-500 bg-orange-500" : "border-gray-300"
                    }`}>
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Refresh */}
      <div className="mt-5 pt-4 border-t border-gray-100 text-center">
        <button onClick={loadAddresses} disabled={loadingZ || loadingS}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50 font-medium">
          Refresh Addresses
        </button>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .input-field:focus {
          border-color: #a78bfa;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
