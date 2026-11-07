'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, Utensils, AlertCircle, Plus, Sparkles } from 'lucide-react';
import { FoodEntry, FoodItem, MealType, PortionUnit } from '@/lib/types';
import { calculatePortionMacros } from '@/lib/nutrition';
import { clientStorage } from '@/lib/client-storage';
import { toast } from 'sonner';

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeal?: MealType;
  date: string;
  userId?: string;
  onSuccess: () => void;
}

const CATEGORIES = ['All', 'Protein', 'Carbohydrates', 'Fruits', 'Vegetables', 'Discretionary'];

export function FoodSearchModal({
  isOpen,
  onClose,
  defaultMeal = 'Breakfast',
  date,
  userId = 'usr_default',
  onSuccess,
}: FoodSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);

  // View state: 'search' | 'portion' | 'custom'
  const [modalMode, setModalMode] = useState<'search' | 'portion' | 'custom'>('search');

  // Selected food for portion configuration
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [portionAmount, setPortionAmount] = useState<number>(1);
  const [portionUnit, setPortionUnit] = useState<PortionUnit>('servings');
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [submitting, setSubmitting] = useState(false);

  // Custom food state
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'Protein' | 'Carbohydrates' | 'Fruits' | 'Vegetables' | 'Discretionary'>('Carbohydrates');
  const [customCalories, setCustomCalories] = useState<number>(200);
  const [customProtein, setCustomProtein] = useState<number>(5);
  const [customCarbs, setCustomCarbs] = useState<number>(30);
  const [customFat, setCustomFat] = useState<number>(4);
  const [customFibre, setCustomFibre] = useState<number>(2);
  const [customPortionAmount, setCustomPortionAmount] = useState<number>(1);
  const [customPortionUnit, setCustomPortionUnit] = useState<PortionUnit>('servings');

  useEffect(() => {
    if (defaultMeal) setMealType(defaultMeal);
  }, [defaultMeal]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchFoods = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (selectedCategory && selectedCategory !== 'All') params.set('category', selectedCategory);

        const res = await fetch(`/api/foods?${params.toString()}`);
        const data = await res.json();
        if (data.foods) setFoods(data.foods);
      } catch (err) {
        console.error('Failed to load foods:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchFoods, 200);
    return () => clearTimeout(debounce);
  }, [isOpen, query, selectedCategory]);

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    setPortionUnit(food.serving_unit_default || 'servings');
    setPortionAmount(food.serving_unit_default === 'grams' || food.serving_unit_default === 'ml' ? 100 : 1);
    setModalMode('portion');
  };

  const handleStartCustom = (initialName: string = '') => {
    setCustomName(initialName || query || 'My Custom Dish');
    setModalMode('custom');
  };

  // Live recalculated macros for preset food
  const liveMacros = useMemo(() => {
    if (!selectedFood) return null;
    return calculatePortionMacros(selectedFood, portionAmount, portionUnit);
  }, [selectedFood, portionAmount, portionUnit]);

  const handleAddPresetFood = async () => {
    if (!selectedFood || portionAmount <= 0) return;

    setSubmitting(true);
    const now = new Date().toISOString();
    const tempId = 'fent_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    const macros = liveMacros || calculatePortionMacros(selectedFood, portionAmount, portionUnit);

    const localEntry: FoodEntry = {
      id: tempId,
      daily_log_id: 'log_' + date,
      meal_type: mealType,
      food_item_id: selectedFood.id,
      custom_name: selectedFood.name,
      portion_amount: portionAmount,
      portion_unit: portionUnit,
      computed_weight_g: macros.computedWeightG,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fibre: macros.fibre,
      is_discretionary: selectedFood.is_discretionary,
      icon: selectedFood.icon || '🍽️',
      created_at: now,
    };

    // 1. GUARANTEED PERSISTENCE: Save to client storage immediately!
    clientStorage.saveFoodEntry(userId, date, localEntry);

    try {
      const res = await fetch('/api/journal/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          meal_type: mealType,
          food_item_id: selectedFood.id,
          portion_amount: portionAmount,
          portion_unit: portionUnit,
        }),
      });

      const data = await res.json();
      if (res.ok && data.entry) {
        // Update client storage with server ID if available
        clientStorage.deleteFoodEntry(userId, date, tempId);
        clientStorage.saveFoodEntry(userId, date, data.entry);
      }

      toast.success(`Added ${selectedFood.name} to ${mealType}`);
      setSelectedFood(null);
      setModalMode('search');
      setPortionAmount(1);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.warn('Network sync issue, but food saved locally:', err);
      toast.success(`Added ${selectedFood.name} to ${mealType} (Saved offline)`);
      setSelectedFood(null);
      setModalMode('search');
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCustomFood = async () => {
    if (!customName.trim() || customCalories < 0) {
      toast.error('Please enter a valid food name and calories.');
      return;
    }

    setSubmitting(true);
    const now = new Date().toISOString();
    const tempId = 'fent_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    const localEntry: FoodEntry = {
      id: tempId,
      daily_log_id: 'log_' + date,
      meal_type: mealType,
      food_item_id: null,
      custom_name: customName.trim(),
      portion_amount: customPortionAmount,
      portion_unit: customPortionUnit,
      computed_weight_g: customPortionUnit === 'grams' ? customPortionAmount : 100,
      calories: customCalories,
      protein: customProtein,
      carbs: customCarbs,
      fat: customFat,
      fibre: customFibre,
      is_discretionary: customCategory === 'Discretionary',
      icon: customCategory === 'Discretionary' ? '🍔' : '🍽️',
      created_at: now,
    };

    // 1. GUARANTEED PERSISTENCE: Save to client storage immediately!
    clientStorage.saveFoodEntry(userId, date, localEntry);

    try {
      const res = await fetch('/api/journal/food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          meal_type: mealType,
          custom_name: customName.trim(),
          portion_amount: customPortionAmount,
          portion_unit: customPortionUnit,
          calories: customCalories,
          protein: customProtein,
          carbs: customCarbs,
          fat: customFat,
          fibre: customFibre,
          is_discretionary: customCategory === 'Discretionary',
          icon: customCategory === 'Discretionary' ? '🍔' : '🍽️',
        }),
      });

      const data = await res.json();
      if (res.ok && data.entry) {
        clientStorage.deleteFoodEntry(userId, date, tempId);
        clientStorage.saveFoodEntry(userId, date, data.entry);
      }

      toast.success(`Added ${customName.trim()} to ${mealType}`);
      setModalMode('search');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.warn('Network sync issue, but food saved locally:', err);
      toast.success(`Added ${customName.trim()} to ${mealType} (Saved offline)`);
      setModalMode('search');
      onSuccess();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {modalMode === 'custom'
                  ? 'Add Custom Food'
                  : modalMode === 'portion'
                  ? 'Configure Portion'
                  : 'Search Food Database'}
              </h2>
              <p className="text-xs text-slate-500">
                {modalMode === 'custom'
                  ? `Enter custom nutritional values for your dish`
                  : modalMode === 'portion' && selectedFood
                  ? `Adjust serving amount for ${selectedFood.name}`
                  : `Select or type any food to add to ${mealType}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {modalMode === 'search' ? (
            /* --- STEP 1: SEARCH & SELECT --- */
            <div className="space-y-4">
              {/* Search Bar & Custom button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Type to search (e.g. Egg, Rice, Dal, Chicken, Dosa)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-sm"
                    autoFocus
                  />
                  {query && (
                    <button
                      onClick={() => setQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleStartCustom(query)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition"
                >
                  <Plus className="w-4 h-4" />
                  Custom Food
                </button>
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition ${
                      selectedCategory === cat
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Meal Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Adding to:</span>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealType)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-slate-700 dark:text-slate-300"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Morning Snack">Morning Snack</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Evening Snack">Evening Snack</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Food List */}
              <div className="space-y-2 mt-4">
                {loading ? (
                  <div className="py-12 text-center text-sm text-slate-400">Searching foods...</div>
                ) : foods.length === 0 ? (
                  <div className="py-10 text-center space-y-3 bg-slate-50 dark:bg-slate-950/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      No preset food found matching &quot;{query}&quot;.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleStartCustom(query)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition"
                    >
                      <Plus className="w-4 h-4" />
                      Add &quot;{query || 'Custom Food'}&quot; Manually
                    </button>
                  </div>
                ) : (
                  foods.map((food) => (
                    <div
                      key={food.id}
                      onClick={() => handleSelectFood(food)}
                      className="group p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{food.icon}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-900 dark:text-white">
                              {food.name}
                            </span>
                            {food.is_discretionary && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-medium">
                                Discretionary
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500">
                            {food.calories_per_100g} kcal / 100g • {food.protein_per_100g}g protein • {food.carbs_per_100g}g carbs
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 group-hover:bg-emerald-600 group-hover:text-white transition">
                          Select
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : modalMode === 'portion' && selectedFood ? (
            /* --- STEP 2: PORTION CONFIGURATION --- */
            <div className="space-y-6">
              {/* Selected Food Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedFood.icon}</span>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{selectedFood.name}</h3>
                    <p className="text-xs text-slate-500">
                      Category: {selectedFood.category} • Base: {selectedFood.calories_per_100g} kcal per 100g
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalMode('search')}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Change Food
                </button>
              </div>

              {/* Portion Amount & Unit Selector */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Serving Amount
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={portionAmount}
                    onChange={(e) => setPortionAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Unit
                  </label>
                  <select
                    value={portionUnit}
                    onChange={(e) => setPortionUnit(e.target.value as PortionUnit)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="servings">servings ({selectedFood.serving_weight_grams}g each)</option>
                    <option value="grams">grams (g)</option>
                    <option value="pieces">pieces</option>
                    <option value="cups">cups (~200g)</option>
                    <option value="ml">ml (millilitres)</option>
                  </select>
                </div>
              </div>

              {/* Quick Amount Pills */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-2">Quick Presets:</label>
                <div className="flex gap-2 flex-wrap">
                  {portionUnit === 'servings' &&
                    [0.5, 1, 1.5, 2, 3].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPortionAmount(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          portionAmount === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {n} serving{n > 1 ? 's' : ''}
                      </button>
                    ))}

                  {portionUnit === 'pieces' &&
                    [1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPortionAmount(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          portionAmount === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {n} pc{n > 1 ? 's' : ''}
                      </button>
                    ))}

                  {portionUnit === 'cups' &&
                    [0.5, 1, 1.5, 2].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPortionAmount(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          portionAmount === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {n} cup{n > 1 ? 's' : ''}
                      </button>
                    ))}

                  {portionUnit === 'grams' &&
                    [50, 100, 150, 200, 250, 300].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPortionAmount(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          portionAmount === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {n}g
                      </button>
                    ))}

                  {portionUnit === 'ml' &&
                    [100, 200, 250, 300, 500].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPortionAmount(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          portionAmount === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {n}ml
                      </button>
                    ))}
                </div>
              </div>

              {/* Meal Slot Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
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
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {slot}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Live Recalculated Nutrition Breakdown */}
              {liveMacros && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Nutritional Yield ({liveMacros.computedWeightG}g equivalent)
                    </span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {liveMacros.calories} kcal
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="block text-[11px] text-slate-400">Protein</span>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveMacros.protein}g</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="block text-[11px] text-slate-400">Carbs</span>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveMacros.carbs}g</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="block text-[11px] text-slate-400">Fat</span>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveMacros.fat}g</span>
                    </div>
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                      <span className="block text-[11px] text-slate-400">Fibre</span>
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{liveMacros.fibre}g</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* --- STEP 3: CUSTOM FOOD ENTRY --- */
            <div className="space-y-4">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Enter custom food details. NutriTrack will log it accurately into your daily macros!</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Dish / Food Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. Chicken Biryani, Protein Shake, Dosa..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-medium text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Protein">Protein</option>
                    <option value="Carbohydrates">Carbohydrates</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Discretionary">Discretionary (Snacks/Treats)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Portion
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={customPortionAmount}
                      onChange={(e) => setCustomPortionAmount(Math.max(0.1, parseFloat(e.target.value) || 1))}
                      className="w-20 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-semibold"
                    />
                    <select
                      value={customPortionUnit}
                      onChange={(e) => setCustomPortionUnit(e.target.value as PortionUnit)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm"
                    >
                      <option value="servings">serving</option>
                      <option value="grams">grams</option>
                      <option value="pieces">pieces</option>
                      <option value="cups">cups</option>
                      <option value="ml">ml</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Calories & Macros Inputs */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Total Calories (kcal)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={customCalories}
                    onChange={(e) => {
                      const cal = Math.max(0, parseInt(e.target.value) || 0);
                      setCustomCalories(cal);
                      // Auto estimate macros based on calories if desired
                      if (cal > 0) {
                        if (customCategory === 'Protein') {
                          setCustomProtein(Math.round((cal * 0.4) / 4));
                          setCustomCarbs(Math.round((cal * 0.3) / 4));
                          setCustomFat(Math.round((cal * 0.3) / 9));
                        } else {
                          setCustomProtein(Math.round((cal * 0.15) / 4));
                          setCustomCarbs(Math.round((cal * 0.55) / 4));
                          setCustomFat(Math.round((cal * 0.3) / 9));
                        }
                      }
                    }}
                    className="w-28 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Protein (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={customProtein}
                      onChange={(e) => setCustomProtein(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Carbs (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={customCarbs}
                      onChange={(e) => setCustomCarbs(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Fat (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={customFat}
                      onChange={(e) => setCustomFat(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Fibre (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={customFibre}
                      onChange={(e) => setCustomFibre(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Meal Slot */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
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
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {slot}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          {modalMode === 'portion' ? (
            <>
              <button
                type="button"
                onClick={() => setModalMode('search')}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Back to Search
              </button>

              <button
                type="button"
                onClick={handleAddPresetFood}
                disabled={submitting || portionAmount <= 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition flex items-center gap-2"
              >
                {submitting ? 'Adding...' : 'Add to Food Journal'}
              </button>
            </>
          ) : modalMode === 'custom' ? (
            <>
              <button
                type="button"
                onClick={() => setModalMode('search')}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Back to Search
              </button>

              <button
                type="button"
                onClick={handleAddCustomFood}
                disabled={submitting || !customName.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition flex items-center gap-2"
              >
                {submitting ? 'Adding...' : 'Add Custom Food'}
              </button>
            </>
          ) : (
            <div className="w-full flex justify-between items-center">
              <button
                type="button"
                onClick={() => handleStartCustom('')}
                className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add custom food
              </button>
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
