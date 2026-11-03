'use client';

import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, AlertTriangle, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import { MealType, PortionUnit } from '@/lib/types';
import { toast } from 'sonner';

interface DetectedItem {
  id: string;
  food_item_id: string;
  name: string;
  category: string;
  portion_amount: number;
  portion_unit: PortionUnit;
  confidence: 'High' | 'Medium' | 'Estimated';
  icon: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
  is_discretionary: boolean;
  selected: boolean;
}

interface PhotoFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeal?: MealType;
  date: string;
  onSuccess: () => void;
}

export function PhotoFoodModal({
  isOpen,
  onClose,
  defaultMeal = 'Lunch',
  date,
  onSuccess,
}: PhotoFoodModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setImagePreview(null);
    setDetectedItems([]);
    setAnalyzing(false);
    setSubmitting(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      analyzePhoto(base64, file.name);
    };
    reader.readAsDataURL(file);
  };

  const analyzePhoto = async (base64: string, filename: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/foods/detect-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, filename }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze photo');

      if (data.detectedFoods && data.detectedFoods.length > 0) {
        const mapped: DetectedItem[] = data.detectedFoods.map((f: DetectedItem, idx: number) => ({
          ...f,
          id: 'det_' + idx + '_' + Math.random().toString(36).substring(2, 6),
          selected: true,
        }));
        setDetectedItems(mapped);
      } else {
        toast.info('No foods automatically recognized. You can add items manually.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error analyzing image';
      toast.error(message);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleItem = (id: string) => {
    setDetectedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updatePortion = (id: string, amount: number) => {
    setDetectedItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const ratio = amount / (item.portion_amount || 1);
        return {
          ...item,
          portion_amount: amount,
          calories: Math.round(item.calories * ratio),
          protein: Number((item.protein * ratio).toFixed(1)),
          carbs: Number((item.carbs * ratio).toFixed(1)),
          fat: Number((item.fat * ratio).toFixed(1)),
          fibre: Number((item.fibre * ratio).toFixed(1)),
        };
      })
    );
  };

  const removeItem = (id: string) => {
    setDetectedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddCustomCandidate = () => {
    const newItem: DetectedItem = {
      id: 'det_custom_' + Date.now(),
      food_item_id: '',
      name: 'Salad / Side Dish',
      category: 'Vegetables',
      portion_amount: 1,
      portion_unit: 'cups',
      confidence: 'Estimated',
      icon: '🥗',
      calories: 45,
      protein: 1.5,
      carbs: 8,
      fat: 0.5,
      fibre: 2.5,
      is_discretionary: false,
      selected: true,
    };
    setDetectedItems((prev) => [...prev, newItem]);
  };

  const handleConfirmAndAdd = async () => {
    const selected = detectedItems.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error('Please select at least one detected food to add.');
      return;
    }

    setSubmitting(true);
    try {
      for (const item of selected) {
        await fetch('/api/journal/food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            meal_type: mealType,
            food_item_id: item.food_item_id || undefined,
            custom_name: item.name,
            portion_amount: item.portion_amount,
            portion_unit: item.portion_unit,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fibre: item.fibre,
            is_discretionary: item.is_discretionary,
            icon: item.icon,
          }),
        });
      }

      toast.success(`Successfully logged ${selected.length} foods from photo.`);
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save foods';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">📸 Add Food From Photo</h2>
              <p className="text-xs text-slate-500">Upload or snap a photo of your meal for AI detection</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Dropzone */}
          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/50 hover:bg-emerald-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Upload className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-200 mb-1">
                Upload or Capture Food Photo
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Take a clear picture of your plate or meal (e.g. Rice, Dal, Vegetables, Eggs, etc.) to analyze nutrition.
              </p>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xs"
              >
                Choose Image File
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview & Change button */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-48 bg-slate-950 flex items-center justify-center">
                <img
                  src={imagePreview}
                  alt="Meal preview"
                  className="w-full h-48 object-cover opacity-90"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/75 hover:bg-black text-white backdrop-blur-md transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retake / Change Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Meal Selector */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Target Meal Slot:
                </span>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Morning Snack">Morning Snack</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Evening Snack">Evening Snack</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Mandatory AI Disclaimer per Spec */}
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                  <strong>AI Food Detection:</strong> AI estimates may be inaccurate. Please review the detected foods and portions before adding them.
                </p>
              </div>

              {/* Analyzing Spinner */}
              {analyzing ? (
                <div className="py-10 text-center space-y-3">
                  <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Analyzing food items on your plate...
                  </p>
                </div>
              ) : (
                /* Detected Items Checklist */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      We found these possible foods:
                    </h3>
                    <button
                      type="button"
                      onClick={handleAddCustomCandidate}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Missing Item
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {detectedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          item.selected
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                            : 'bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {/* Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleItem(item.id)}
                              className={`w-6 h-6 rounded-lg border flex items-center justify-center transition ${
                                item.selected
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                              }`}
                            >
                              {item.selected && <Check className="w-4 h-4 stroke-[3]" />}
                            </button>

                            <span className="text-2xl">{item.icon}</span>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                  {item.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                                  {item.confidence} Match
                                </span>
                              </div>
                              <span className="text-xs text-slate-500">
                                {item.calories} kcal • {item.protein}g protein • {item.carbs}g carbs
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Portion Adjuster */}
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                              <input
                                type="number"
                                step="any"
                                min="0.1"
                                value={item.portion_amount}
                                onChange={(e) => updatePortion(item.id, parseFloat(e.target.value) || 0)}
                                className="w-12 text-center text-xs font-bold bg-transparent text-slate-900 dark:text-white focus:outline-hidden"
                              />
                              <span className="text-[11px] text-slate-400 font-medium">
                                {item.portion_unit}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition"
                              title="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Cancel
          </button>

          {imagePreview && !analyzing && (
            <button
              type="button"
              onClick={handleConfirmAndAdd}
              disabled={submitting || detectedItems.filter((i) => i.selected).length === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition flex items-center gap-2"
            >
              {submitting ? 'Adding...' : 'Confirm & Add to Journal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
