'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Barcode,
  Camera,
  X,
  Search,
  Check,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { FoodEntry, MealType, PortionUnit } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

interface BarcodeProduct {
  name: string;
  category: string;
  brand: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  fibre_per_100g: number;
  serving_weight_grams: number;
  serving_unit_default: PortionUnit;
  icon: string;
  imageUrl?: string;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeal?: MealType;
  date: string;
  userId?: string;
  onSuccess: () => void;
}

const SAMPLE_BARCODES = [
  { label: '🥛 Amul Taaza Milk', code: '8901262010053' },
  { label: '🥣 Quaker Oats', code: '8901491101836' },
  { label: '🍫 Snickers Bar', code: '5000159461122' },
  { label: '🍪 Oreo Cookies', code: '7622210403758' },
];

export function BarcodeScannerModal({
  isOpen,
  onClose,
  defaultMeal = 'Breakfast',
  date,
  userId = 'usr_default',
  onSuccess,
}: BarcodeScannerModalProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<BarcodeProduct | null>(null);

  // Portion configuration
  const [portionAmount, setPortionAmount] = useState<number>(1);
  const [portionUnit, setPortionUnit] = useState<PortionUnit>('servings');
  const [mealType, setMealType] = useState<MealType>(defaultMeal);

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (defaultMeal) setMealType(defaultMeal);
  }, [defaultMeal]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedProduct(null);
      setBarcodeInput('');
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      toast.info('Camera activated! Point at barcode or enter the number below.');
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      toast.error('Camera access unavailable. You can type the barcode number below.');
      setCameraActive(false);
    }
  };

  const handleLookupBarcode = async (codeToLookup?: string) => {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code) {
      toast.error('Please enter or scan a barcode.');
      return;
    }

    setLoading(true);
    stopCamera();

    try {
      const res = await fetch(`/api/foods/barcode/${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok || !data.product) {
        throw new Error(data.error || 'Barcode not found. Try entering another code.');
      }

      setScannedProduct(data.product);
      setPortionAmount(1);
      setPortionUnit('servings');
      toast.success(`Found: ${data.product.name}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching barcode product';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Calculated macros for portion
  const computedWeightG = scannedProduct
    ? portionUnit === 'grams' || portionUnit === 'ml'
      ? portionAmount
      : portionAmount * (scannedProduct.serving_weight_grams || 100)
    : 100;

  const multiplier = computedWeightG / 100;

  const liveCalories = scannedProduct ? Math.round(scannedProduct.calories_per_100g * multiplier) : 0;
  const liveProtein = scannedProduct ? Number((scannedProduct.protein_per_100g * multiplier).toFixed(1)) : 0;
  const liveCarbs = scannedProduct ? Number((scannedProduct.carbs_per_100g * multiplier).toFixed(1)) : 0;
  const liveFat = scannedProduct ? Number((scannedProduct.fat_per_100g * multiplier).toFixed(1)) : 0;
  const liveFibre = scannedProduct ? Number((scannedProduct.fibre_per_100g * multiplier).toFixed(1)) : 0;

  const handleAddScannedFood = async () => {
    if (!scannedProduct) return;

    setSubmitting(true);
    const now = new Date().toISOString();
    const tempId = 'fent_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    const localEntry: FoodEntry = {
      id: tempId,
      daily_log_id: 'log_' + date,
      meal_type: mealType,
      custom_name: scannedProduct.name,
      portion_amount: portionAmount,
      portion_unit: portionUnit,
      computed_weight_g: portionUnit === 'grams' ? portionAmount : scannedProduct.serving_weight_grams || 100,
      calories: liveCalories,
      protein: liveProtein,
      carbs: liveCarbs,
      fat: liveFat,
      fibre: liveFibre,
      is_discretionary: scannedProduct.category === 'Discretionary',
      icon: '📦',
      created_at: now,
    };

    // 1. GUARANTEED PERSISTENCE: Save to phone storage FIRST!
    clientStorage.saveFoodEntry(userId, date, localEntry);

    try {
      const res = await fetch('/api/journal/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          meal_type: mealType,
          custom_name: scannedProduct.name,
          portion_amount: portionAmount,
          portion_unit: portionUnit,
          calories: liveCalories,
          protein: liveProtein,
          carbs: liveCarbs,
          fat: liveFat,
          fibre: liveFibre,
          is_discretionary: scannedProduct.category === 'Discretionary',
          icon: '📦',
        }),
      });

      const data = await res.json();
      if (res.ok && data.entry) {
        clientStorage.deleteFoodEntry(userId, date, tempId);
        clientStorage.saveFoodEntry(userId, date, data.entry);
      }

      toast.success(`Added ${scannedProduct.name} to ${mealType}`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.warn('Network sync issue, but barcode item saved locally:', err);
      toast.success(`Added ${scannedProduct.name} to ${mealType} (Saved offline)`);
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Packaged Food Barcode Scanner
              </h2>
              <p className="text-xs text-slate-500">Scan or enter 13-digit barcode for instant nutrition</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!scannedProduct ? (
            <>
              {/* Camera Scanner Viewfinder */}
              {cameraActive ? (
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                  {/* Viewfinder Overlay */}
                  <div className="absolute inset-0 border-2 border-indigo-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-32 border-2 border-dashed border-white/80 rounded-xl relative animate-pulse">
                      <span className="absolute -top-6 left-0 right-0 text-center text-xs text-white font-medium drop-shadow-md">
                        Align barcode within frame
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="absolute top-3 right-3 px-3 py-1 rounded-lg bg-black/60 text-white text-xs font-semibold backdrop-blur-md"
                  >
                    Close Camera
                  </button>
                </div>
              ) : (
                <div
                  onClick={startCamera}
                  className="p-6 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-900 hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-center cursor-pointer transition group"
                >
                  <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition">
                    <Camera className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 mb-1">
                    Tap to Open Barcode Camera
                  </h4>
                  <p className="text-xs text-slate-500">Scan cereal boxes, milk, biscuits, protein snacks</p>
                </div>
              )}

              {/* Manual Barcode Input */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Or Type Barcode Number
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookupBarcode()}
                    placeholder="e.g. 8901262010053"
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupBarcode()}
                    disabled={loading || !barcodeInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Lookup
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Sample Barcodes */}
              <div className="pt-2">
                <span className="text-[11px] font-medium text-slate-500 block mb-2">
                  Try with popular test barcodes:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SAMPLE_BARCODES.map((s) => (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => {
                        setBarcodeInput(s.code);
                        handleLookupBarcode(s.code);
                      }}
                      className="p-2 rounded-xl text-left bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs text-slate-700 dark:text-slate-300 transition"
                    >
                      <span className="font-semibold block">{s.label}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{s.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Scanned Product Details & Portion Customization */
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 flex items-center gap-3">
                {scannedProduct.imageUrl ? (
                  <img
                    src={scannedProduct.imageUrl}
                    alt={scannedProduct.name}
                    className="w-14 h-14 rounded-xl object-contain bg-white p-1 border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-2xl flex items-center justify-center shrink-0">
                    📦
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                    {scannedProduct.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Base: {scannedProduct.calories_per_100g} kcal / 100g • {scannedProduct.serving_weight_grams}g per serving
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScannedProduct(null)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0"
                >
                  Rescan
                </button>
              </div>

              {/* Portion Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Portion Amount
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={portionAmount}
                    onChange={(e) => setPortionAmount(Math.max(0.1, parseFloat(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Unit
                  </label>
                  <select
                    value={portionUnit}
                    onChange={(e) => setPortionUnit(e.target.value as PortionUnit)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="servings">servings ({scannedProduct.serving_weight_grams}g each)</option>
                    <option value="grams">grams (g)</option>
                    <option value="pieces">pieces</option>
                    <option value="cups">cups</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>

              {/* Meal Slot Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Meal Slot
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Breakfast', 'Morning Snack', 'Lunch', 'Evening Snack', 'Dinner', 'Other'] as MealType[]).map(
                    (slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setMealType(slot)}
                        className={`py-2 px-3 rounded-xl text-xs font-semibold transition text-center ${
                          mealType === slot
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {slot}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Live Yield */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Calculated Nutrition ({Math.round(computedWeightG)}g)
                  </span>
                  <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                    {liveCalories} kcal
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="block text-[11px] text-slate-400">Protein</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveProtein}g</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="block text-[11px] text-slate-400">Carbs</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveCarbs}g</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="block text-[11px] text-slate-400">Fat</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveFat}g</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                    <span className="block text-[11px] text-slate-400">Fibre</span>
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveFibre}g</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          {scannedProduct ? (
            <>
              <button
                type="button"
                onClick={() => setScannedProduct(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Back to Scanner
              </button>
              <button
                type="button"
                onClick={handleAddScannedFood}
                disabled={submitting}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 disabled:opacity-50 transition flex items-center gap-2"
              >
                {submitting ? 'Adding...' : 'Add to Food Journal'}
              </button>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
