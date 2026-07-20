"use client";

import { useEffect, useState } from "react";
import {
  getZeptoAddresses,
  selectZeptoAddress,
  addZeptoAddress,
  getSwiggyAddresses,
} from "@/lib/api";

interface Address {
  id: string;
  addressId?: string;
  name?: string;
  type?: string;
  formattedAddress?: string;
  shortAddress?: string;
  address?: string;
  [key: string]: unknown;
}

export default function AddressManager() {
  const [zeptoAddresses, setZeptoAddresses] = useState<Address[]>([]);
  const [swiggyAddresses, setSwiggyAddresses] = useState<Address[]>([]);
  const [selectedZepto, setSelectedZepto] = useState<string | null>(null);
  const [selectedSwiggy, setSelectedSwiggy] = useState<string | null>(null);
  const [loading, setLoading] = useState({ zepto: false, swiggy: false });
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);

  const [newAddr, setNewAddr] = useState({
    type: "HOME",
    name: "Home",
    flat_details: "",
    building_name: "",
    landmark: "",
    latitude: 0,
    longitude: 0,
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
    setLoading({ zepto: true, swiggy: true });

    // Load both in parallel
    const [zResult, sResult] = await Promise.allSettled([
      getZeptoAddresses(),
      getSwiggyAddresses(),
    ]);

    if (zResult.status === "fulfilled") {
      setZeptoAddresses(zResult.value.addresses || []);
    }
    if (sResult.status === "fulfilled") {
      setSwiggyAddresses(sResult.value.addresses || []);
    }

    if (zResult.status === "rejected" && sResult.status === "rejected") {
      setError("Could not load addresses from either platform. Make sure you have authenticated with Zepto and Swiggy.");
    }

    setLoading({ zepto: false, swiggy: false });
  }

  async function handleSelectZepto(addressId: string) {
    try {
      await selectZeptoAddress(addressId);
      setSelectedZepto(addressId);
    } catch {
      setError("Failed to select Zepto address");
    }
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewAddr((prev) => ({
          ...prev,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
      },
      () => setError("Unable to get your location. Please enter coordinates manually.")
    );
  }

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!newAddr.flat_details || !newAddr.building_name || !newAddr.latitude || !newAddr.longitude) {
      setError("Please fill in all required fields including coordinates");
      return;
    }
    setAddingAddress(true);
    setError(null);
    try {
      await addZeptoAddress({
        ...newAddr,
        formatted_address: newAddr.formatted_address || `${newAddr.flat_details}, ${newAddr.building_name}, ${newAddr.short_address}`,
      });
      setShowAddForm(false);
      setNewAddr({
        type: "HOME", name: "Home", flat_details: "", building_name: "",
        landmark: "", latitude: 0, longitude: 0, formatted_address: "",
        short_address: "", contact_name: "", contact_number: "",
      });
      await loadAddresses();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add address");
    } finally {
      setAddingAddress(false);
    }
  }

  function getDisplayAddress(addr: Address): string {
    return addr.formattedAddress || addr.shortAddress || addr.address || addr.name || addr.id;
  }

  function getAddressLabel(addr: Address): string {
    return addr.type || addr.name || "Address";
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-1">
        Delivery Addresses
      </h3>
      <p className="text-sm text-gray-400 mb-4">
        Select your delivery address for Zepto and Swiggy. Both platforms need an address to search products.
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      {/* Zepto Addresses */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full" />
            Zepto
          </h4>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs px-3 py-1 bg-purple-50 text-purple-600 rounded-full
                       hover:bg-purple-100 transition-colors font-medium"
          >
            {showAddForm ? "Cancel" : "+ Add Address"}
          </button>
        </div>

        {loading.zepto ? (
          <p className="text-sm text-gray-400">Loading Zepto addresses...</p>
        ) : zeptoAddresses.length === 0 ? (
          <p className="text-sm text-gray-400">
            No saved addresses. Add one to start ordering from Zepto.
          </p>
        ) : (
          <div className="space-y-2">
            {zeptoAddresses.map((addr) => {
              const id = addr.id || addr.addressId || "";
              const isSelected = selectedZepto === id;
              return (
                <button
                  key={id}
                  onClick={() => handleSelectZepto(id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? "border-purple-400 bg-purple-50 ring-1 ring-purple-200"
                      : "border-gray-200 hover:border-purple-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-purple-600 uppercase tracking-wide">
                        {getAddressLabel(addr)}
                      </span>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {getDisplayAddress(addr)}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-xs bg-purple-500 text-white px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Add Address Form */}
        {showAddForm && (
          <form onSubmit={handleAddAddress} className="mt-4 p-4 bg-gray-50 rounded-xl space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={newAddr.type}
                  onChange={(e) => setNewAddr({ ...newAddr, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
                >
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Label</label>
                <input
                  type="text"
                  value={newAddr.name}
                  onChange={(e) => setNewAddr({ ...newAddr, name: e.target.value })}
                  placeholder="My Home"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Flat / House No. *</label>
              <input
                type="text"
                value={newAddr.flat_details}
                onChange={(e) => setNewAddr({ ...newAddr, flat_details: e.target.value })}
                placeholder="A-101"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Building / Society Name *</label>
              <input
                type="text"
                value={newAddr.building_name}
                onChange={(e) => setNewAddr({ ...newAddr, building_name: e.target.value })}
                placeholder="Sunrise Apartments"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Landmark</label>
              <input
                type="text"
                value={newAddr.landmark}
                onChange={(e) => setNewAddr({ ...newAddr, landmark: e.target.value })}
                placeholder="Near City Mall"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Area / City *</label>
              <input
                type="text"
                value={newAddr.short_address}
                onChange={(e) => setNewAddr({ ...newAddr, short_address: e.target.value })}
                placeholder="Kothrud, Pune"
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Full Address</label>
              <input
                type="text"
                value={newAddr.formatted_address}
                onChange={(e) => setNewAddr({ ...newAddr, formatted_address: e.target.value })}
                placeholder="A-101, Sunrise Apartments, Kothrud, Pune 411038"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Latitude *</label>
                <input
                  type="number"
                  step="any"
                  value={newAddr.latitude || ""}
                  onChange={(e) => setNewAddr({ ...newAddr, latitude: parseFloat(e.target.value) || 0 })}
                  placeholder="18.5089"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Longitude *</label>
                <input
                  type="number"
                  step="any"
                  value={newAddr.longitude || ""}
                  onChange={(e) => setNewAddr({ ...newAddr, longitude: parseFloat(e.target.value) || 0 })}
                  placeholder="73.9260"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              className="w-full text-sm text-purple-600 hover:text-purple-700 py-2
                         border border-dashed border-purple-200 rounded-lg
                         hover:bg-purple-50 transition-colors"
            >
              Use my current location
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={newAddr.contact_name}
                  onChange={(e) => setNewAddr({ ...newAddr, contact_name: e.target.value })}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contact Number</label>
                <input
                  type="text"
                  value={newAddr.contact_number}
                  onChange={(e) => setNewAddr({ ...newAddr, contact_number: e.target.value })}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-purple-300"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={addingAddress}
              className="w-full px-4 py-2.5 bg-purple-500 text-white text-sm font-medium
                         rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
            >
              {addingAddress ? "Saving..." : "Save Address"}
            </button>
          </form>
        )}
      </div>

      {/* Swiggy Addresses */}
      <div>
        <h4 className="font-semibold text-gray-700 flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-orange-500 rounded-full" />
          Swiggy Instamart
        </h4>

        {loading.swiggy ? (
          <p className="text-sm text-gray-400">Loading Swiggy addresses...</p>
        ) : swiggyAddresses.length === 0 ? (
          <p className="text-sm text-gray-400">
            No saved addresses. Add addresses in the Swiggy app first.
          </p>
        ) : (
          <div className="space-y-2">
            {swiggyAddresses.map((addr, idx) => {
              const id = addr.id || addr.addressId || String(idx);
              const isSelected = selectedSwiggy === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedSwiggy(id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? "border-orange-400 bg-orange-50 ring-1 ring-orange-200"
                      : "border-gray-200 hover:border-orange-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-medium text-orange-600 uppercase tracking-wide">
                        {getAddressLabel(addr)}
                      </span>
                      <p className="text-sm text-gray-700 mt-0.5">
                        {getDisplayAddress(addr)}
                      </p>
                    </div>
                    {isSelected && (
                      <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                        Selected
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Refresh button */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={loadAddresses}
          disabled={loading.zepto || loading.swiggy}
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
        >
          Refresh addresses
        </button>
      </div>
    </div>
  );
}
