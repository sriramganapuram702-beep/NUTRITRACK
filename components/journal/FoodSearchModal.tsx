'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Check, Utensils, AlertCircle } from 'lucide-react';
import { FoodItem, MealType, PortionUnit } from '@/lib/types';
import { calculatePortionMacros } from '@/lib/nutrition';
import { toast } from 'sonner';

interface FoodSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeal?: MealType;
  date: string;
  onSuccess: () => void;
}

const CATEGORIES = ['All', 'Protein', 'Carbohydrates', 'Fruits', 'Vegetables', 'Discretionary'];

export function FoodSearchModal({
  isOpen,
  onClose,
  defaultMeal = 'Breakfast',
  date,
  onSuccess,
}: FoodSearchModalProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected food for portion configuration
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [portionAmount, setPortionAmount] = useState<number>(1);
  const [portionUnit, setPortionUnit] = useState<PortionUnit>('servings');
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [submitting, setSubmitting] = useState(false);

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
  };

  // Live recalculated macros
  const liveMacros = useMemo(() => {
    if (!selectedFood) return null;
    return calculatePortionMacros(selectedFood, portionAmount, portionUnit);
  }, [selectedFood, portionAmount, portionUnit]);

  const handleAddFood = async () => {
    if (!selectedFood || portionAmount <= 0) return;

    setSubmitting(true);
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
      if (!res.ok) throw new Error(data.error || 'Failed to add food');

      toast.success(`Added ${selectedFood.name} to ${mealType}`);
      setSelectedFood(null);
      setPortionAmount(1);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error adding food';
      toast.error(message);
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
                {selectedFood ? 'Configure Portion' : 'Search Food Database'}
              </h2>
              <p className="text-xs text-slate-500">
                {selectedFood ? `Adjust serving amount for ${selectedFood.name}` : `Select food to add to ${mealType}`}
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
          {!selectedFood ? (
            /* --- STEP 1: SEARCH & SELECT --- */
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to search (e.g. Egg, Rice, Dal, Chicken, Banana)..."
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
                  <div className="py-12 text-center text-sm text-slate-400">
                    No foods found matching your query.
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
                            {food.calories_per_100g} kcal / 100g • {food.protein_per_100g}g protein
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
          ) : (
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
                  onClick={() => setSelectedFood(null)}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Change Food
                </button>
              </div>

              {/* Portion Input & Unit */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Portion & Unit
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      value={portionAmount || ''}
                      onChange={(e) => setPortionAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-base focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                      placeholder="Amount"
                    />
                  </div>

                  <div>
                    <select
                      value={portionUnit}
                      onChange={(e) => setPortionUnit(e.target.value as PortionUnit)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    >
                      <option value="pieces">Pieces</option>
                      <option value="cups">Cups</option>
                      <option value="grams">Grams (g)</option>
                      <option value="ml">Millilitres (ml)</option>
                      <option value="servings">Servings</option>
                    </select>
                  </div>
                </div>

                {/* Quick Preset Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {portionUnit === 'pieces' &&
                    [1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPortionAmount(n)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          portionAmount === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {n} {n === 1 ? 'piece' : 'pieces'}
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
                        {n} {n === 1 ? 'cup' : 'cups'}
                      </button>
                    ))}

                  {portionUnit === 'grams' &&
                    [50, 100, 150, 200, 250].map((n) => (
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
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          {selectedFood ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedFood(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                Back to Search
              </button>

              <button
                type="button"
                onClick={handleAddFood}
                disabled={submitting || portionAmount <= 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 disabled:opacity-50 transition flex items-center gap-2"
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
