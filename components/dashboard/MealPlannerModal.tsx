'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  ChefHat,
  CheckSquare,
  Square,
  Copy,
  Check,
  Flame,
  ArrowRight,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { toast } from 'sonner';

interface MealPlanBudget {
  targetCalories: number;
  consumedCalories: number;
  remainingCalories: number;
  targetProtein: number;
  consumedProtein: number;
  remainingProtein: number;
}

interface MealRecommendation {
  id: string;
  title: string;
  type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description: string;
  ingredients: string[];
}

interface GroceryItem {
  item: string;
  category: string;
  checked: boolean;
}

interface MealPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  date?: string;
  userId?: string;
}

export function MealPlannerModal({ isOpen, onClose, date, userId }: MealPlannerModalProps) {
  const [loading, setLoading] = useState(false);
  const [budget, setBudget] = useState<MealPlanBudget | null>(null);
  const [recommendations, setRecommendations] = useState<MealRecommendation[]>([]);
  const [groceryList, setGroceryList] = useState<GroceryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'meals' | 'grocery'>('meals');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPlan = async () => {
      setLoading(true);
      try {
        const queryDate = date || new Date().toISOString().split('T')[0];
        const res = await fetch(`/api/ai/meal-plan?date=${queryDate}`);
        const data = await res.json();
        if (data.success) {
          setBudget(data.budget);
          setRecommendations(data.recommendations || []);
          setGroceryList(data.groceryChecklist || []);
        }
      } catch (err) {
        console.error('Failed to load meal plan:', err);
        toast.error('Could not load AI meal suggestions.');
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [isOpen, date]);

  const toggleGrocery = (index: number) => {
    setGroceryList((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, checked: !item.checked } : item))
    );
  };

  const copyGroceryList = () => {
    const text = groceryList
      .map((g) => `${g.checked ? '✅' : '⬜'} ${g.item} (${g.category})`)
      .join('\n');
    navigator.clipboard.writeText(`🛒 NutriTrack Grocery List:\n\n${text}`);
    setCopied(true);
    toast.success('Grocery list copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                AI Meal Planner & Groceries <Sparkles className="w-4 h-4 text-amber-500" />
              </h2>
              <p className="text-xs text-slate-500">Curated meal ideas based on your remaining daily calories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Budget Summary Banner */}
        {budget && (
          <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Remaining Today:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300 ml-1.5">
                🔥 {budget.remainingCalories} kcal
              </span>
            </div>
            <div>
              <span className="text-slate-500">Protein Needed:</span>
              <span className="font-bold text-teal-700 dark:text-teal-300 ml-1.5">
                💪 {budget.remainingProtein}g
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('meals')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'meals'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            Meal Recommendations
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grocery')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'grocery'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Smart Grocery Checklist ({groceryList.filter((g) => g.checked).length}/{groceryList.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-16 text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
              <p className="text-xs text-slate-500">Crafting personalized meal suggestions...</p>
            </div>
          ) : activeTab === 'meals' ? (
            <div className="space-y-4">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{rec.title}</h4>
                        <span className="text-[10px] px-2 py-0.5 rounded-md font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          {rec.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{rec.description}</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm block">
                        {rec.calories} kcal
                      </span>
                      <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">
                        {rec.protein}g protein
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Ingredients Checklist:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {rec.ingredients.map((ing, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">Tap items to mark as purchased or available:</span>
                <button
                  type="button"
                  onClick={copyGroceryList}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy List'}
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                {groceryList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => toggleGrocery(idx)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      {item.checked ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      )}
                      <span
                        className={`text-xs font-medium ${
                          item.checked
                            ? 'line-through text-slate-400 dark:text-slate-500'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {item.item}
                      </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                      {item.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-950">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
