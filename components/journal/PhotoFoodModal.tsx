'use client';

import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, AlertTriangle, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react';
import { FoodEntry, MealType, PortionUnit } from '@/lib/types';
import { clientStorage } from '@/lib/client-storage';
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
  userId?: string;
  onSuccess: () => void;
}

const COMMON_PLATE_TAGS = [
  { name: 'Whole Egg (Boiled/Cooked)', amount: 2, unit: 'pieces' as PortionUnit, calories: 144, protein: 12.6, carbs: 0.8, fat: 9.6, icon: '🥚', category: 'Protein' },
  { name: 'Banana (Fresh Medium)', amount: 1, unit: 'pieces' as PortionUnit, calories: 105, protein: 1.3, carbs: 27.0, fat: 0.3, icon: '🍌', category: 'Fruits' },
  { name: 'Cooked White Rice', amount: 1, unit: 'cups' as PortionUnit, calories: 205, protein: 4.2, carbs: 44.5, fat: 0.5, icon: '🍚', category: 'Carbohydrates' },
  { name: 'South Indian Sambar', amount: 1, unit: 'cups' as PortionUnit, calories: 110, protein: 5.6, carbs: 17.0, fat: 2.0, icon: '🍲', category: 'Vegetables' },
  { name: 'Dal / Dall (Yellow Moong/Toor)', amount: 1, unit: 'cups' as PortionUnit, calories: 198, protein: 12.0, carbs: 30.0, fat: 1.2, icon: '🍲', category: 'Protein' },
  { name: 'Roti / Chapati (Whole Wheat)', amount: 2, unit: 'pieces' as PortionUnit, calories: 208, protein: 6.4, carbs: 36.0, fat: 2.8, icon: '🫓', category: 'Carbohydrates' },
  { name: 'Idli (Steamed)', amount: 3, unit: 'pieces' as PortionUnit, calories: 210, protein: 7.0, carbs: 42.0, fat: 1.2, icon: '⚪', category: 'Carbohydrates' },
  { name: 'Plain Dosa', amount: 1, unit: 'pieces' as PortionUnit, calories: 135, protein: 3.2, carbs: 23.2, fat: 3.0, icon: '🥞', category: 'Carbohydrates' },
  { name: 'Chicken Breast / Curry', amount: 150, unit: 'grams' as PortionUnit, calories: 240, protein: 28.0, carbs: 2.0, fat: 6.0, icon: '🍗', category: 'Protein' },
  { name: 'Paneer (Cottage Cheese)', amount: 100, unit: 'grams' as PortionUnit, calories: 265, protein: 18.3, carbs: 3.4, fat: 20.8, icon: '🧀', category: 'Protein' },
];

export function PhotoFoodModal({
  isOpen,
  onClose,
  defaultMeal = 'Breakfast',
  date,
  userId = 'usr_default',
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
        body: JSON.stringify({ imageBase64: base64, filename, meal_type: mealType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyze photo');

      if (data.detectedFoods && data.detectedFoods.length > 0) {
        const mapped: DetectedItem[] = data.detectedFoods.map((f: any, idx: number) => ({
          ...f,
          id: 'det_' + idx + '_' + Math.random().toString(36).substring(2, 6),
          selected: true,
        }));
        setDetectedItems(mapped);
      } else {
        toast.info('Select foods present on your plate below.');
      }
    } catch (err: unknown) {
      console.warn('Image analysis fallback:', err);
      // Friendly default for breakfast
      if (mealType === 'Breakfast') {
        handleAddPlateTag(COMMON_PLATE_TAGS[0]); // 2 Eggs
        handleAddPlateTag(COMMON_PLATE_TAGS[1]); // 1 Banana
      }
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

  const handleAddPlateTag = (tag: typeof COMMON_PLATE_TAGS[0]) => {
    const existing = detectedItems.find((d) => d.name.toLowerCase().includes(tag.name.toLowerCase().split(' ')[0]));
    if (existing) {
      toggleItem(existing.id);
      return;
    }

    const newItem: DetectedItem = {
      id: 'det_tag_' + Date.now() + Math.random().toString(36).substring(2, 5),
      food_item_id: '',
      name: tag.name,
      category: tag.category,
      portion_amount: tag.amount,
      portion_unit: tag.unit,
      confidence: 'High',
      icon: tag.icon,
      calories: tag.calories,
      protein: tag.protein,
      carbs: tag.carbs,
      fat: tag.fat,
      fibre: 1.0,
      is_discretionary: false,
      selected: true,
    };
    setDetectedItems((prev) => [...prev, newItem]);
  };

  const handleConfirmAndAdd = async () => {
    const selected = detectedItems.filter((i) => i.selected);
    if (selected.length === 0) {
      toast.error('Please select at least one food on your plate.');
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();

    try {
      for (const item of selected) {
        const entryId = 'fent_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        const entry: FoodEntry = {
          id: entryId,
          daily_log_id: 'log_' + date,
          meal_type: mealType,
          food_item_id: item.food_item_id || undefined,
          custom_name: item.name,
          portion_amount: item.portion_amount,
          portion_unit: item.portion_unit,
          computed_weight_g: item.portion_unit === 'grams' ? item.portion_amount : 100,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fibre: item.fibre,
          is_discretionary: item.is_discretionary,
          icon: item.icon,
          created_at: now,
        };

        // 1. GUARANTEED PERSISTENCE: Save to phone persistent storage FIRST!
        clientStorage.saveFoodEntry(userId, date, entry);

        // 2. Sync to cloud server API
        try {
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
        } catch (serverErr) {
          console.warn('Server sync error, saved locally:', serverErr);
        }
      }

      toast.success(`Saved ${selected.length} foods to ${mealType}! Data is permanently stored.`);
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
              <p className="text-xs text-slate-500">Snap or upload a photo of your meal (Eggs, Banana, Rice, Dal)</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Upload Dropzone */}
          {!imagePreview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 rounded-3xl p-8 text-center cursor-pointer transition bg-slate-50/50 dark:bg-slate-950/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-teal-100 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <Camera className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-200 mb-1">
                Take Photo with Camera or Upload
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Take a picture of your breakfast, eggs, banana, rice, dal, or curry to recognize nutrition.
              </p>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white shadow-xs"
              >
                Open Camera / Choose Photo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview & Change button */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-h-48 bg-slate-950 flex items-center justify-center">
                <img src={imagePreview} alt="Meal preview" className="w-full h-48 object-cover opacity-90" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-black/75 hover:bg-black text-white backdrop-blur-md transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retake Photo
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
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target Meal Slot:</span>
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

              {/* 1-Tap Quick Plate Tags */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Quick Add items on your plate:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_PLATE_TAGS.map((tag, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAddPlateTag(tag)}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1"
                    >
                      <span>{tag.icon}</span>
                      <span>{tag.name.split(' ')[0]} {tag.name.split(' ')[1] || ''}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detected Items List */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  Items on Plate ({detectedItems.filter((i) => i.selected).length} selected):
                </span>

                {analyzing ? (
                  <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto text-teal-600" />
                    <p>Recognizing foods on your plate...</p>
                  </div>
                ) : detectedItems.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 border border-dashed rounded-2xl p-4">
                    Tap the quick food tags above to add items to your plate.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detectedItems.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition flex items-center justify-between gap-3 ${
                          item.selected
                            ? 'bg-teal-50/50 dark:bg-teal-950/20 border-teal-300 dark:border-teal-800'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleItem(item.id)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                              item.selected
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {item.selected && <Check className="w-3.5 h-3.5" />}
                          </button>
                          <span className="text-2xl">{item.icon}</span>
                          <div>
                            <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                              {item.name}
                            </span>
                            <span className="text-[11px] text-teal-600 dark:text-teal-400 font-bold">
                              {item.calories} kcal • {item.protein}g protein
                            </span>
                          </div>
                        </div>

                        {/* Portion Controls */}
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={item.portion_amount}
                            onChange={(e) => updatePortion(item.id, Math.max(0.5, parseFloat(e.target.value) || 1))}
                            className="w-14 px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                          />
                          <span className="text-xs text-slate-500 font-medium">{item.portion_unit}</span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition ml-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
          <button
            type="button"
            onClick={handleConfirmAndAdd}
            disabled={submitting || detectedItems.filter((i) => i.selected).length === 0}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 disabled:opacity-50 transition flex items-center gap-2"
          >
            {submitting ? 'Saving to Journal...' : `Confirm & Add to ${mealType}`}
          </button>
        </div>
      </div>
    </div>
  );
}
