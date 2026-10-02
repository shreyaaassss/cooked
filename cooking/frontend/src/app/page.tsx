"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChatInput from "@/components/ChatInput";
import RecipeCard from "@/components/RecipeCard";
import ComparisonTable from "@/components/ComparisonTable";
import ConfirmationCard from "@/components/ConfirmationCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  comparePrices,
  agentRun,
  decomposeRecipe,
} from "@/lib/api";
import type {
  AppStep,
  CompareResult,
  RecipeResult,
  SkippedItem,
} from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<AppStep>("input");
  const [dish, setDish] = useState("");
  const [servings, setServings] = useState(4);
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [comparison, setComparison] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  async function handleDishSubmit(inputDish: string, inputServings: number) {
    setDish(inputDish);
    setServings(inputServings);
    setError(null);

    // Step 1: Decompose recipe
    setStep("recipe");
    try {
      const recipeResult = await decomposeRecipe(inputDish, inputServings);
      setRecipe(recipeResult);

      // Step 2: Compare prices
      setStep("comparing");
      const compareResult = await comparePrices(recipeResult.ingredients);
      setComparison(compareResult as unknown as CompareResult);
      setStep("comparison");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  // Ordering is handled by the agent: it re-checks the pantry, searches both
  // stores, enforces spend limits and asks for approval before any purchase.
  async function handleConfirmCheckout() {
    if (!comparison?.recommended) return;
    setCheckoutLoading(true);
    try {
      const { session_id } = await agentRun(
        `Order the ingredients for ${dish} for ${servings} people`
      );
      router.push(`/agent?session=${session_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setStep("error");
      setCheckoutLoading(false);
    }
  }

  function handleReset() {
    setStep("input");
    setDish("");
    setServings(4);
    setRecipe(null);
    setComparison(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      {step === "input" && (
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            What are you cooking?
          </h1>
          <p className="text-gray-500 text-lg">
            Tell us the dish and we&apos;ll handle the rest — ingredients, price
            comparison, and checkout.
          </p>
        </div>
      )}

      {/* Chat input */}
      {(
        <ChatInput
          onSubmit={handleDishSubmit}
          disabled={step !== "input" && step !== "error"}
        />
      )}

      {/* Loading: recipe decomposition */}
      {step === "recipe" && !recipe && (
        <LoadingSpinner message={`Breaking down ${dish} into ingredients...`} />
      )}

      {/* Recipe card */}
      {recipe && step !== "input" && (
        <RecipeCard
          dish={recipe.dish}
          servings={recipe.servings}
          ingredients={recipe.ingredients}
          skipped={comparison?.skipped}
        />
      )}

      {/* Loading: comparing prices */}
      {step === "comparing" && (
        <LoadingSpinner message="Comparing prices across Zepto & Swiggy Instamart..." />
      )}

      {/* Comparison table */}
      {comparison &&
        (step === "comparison" || step === "confirmation") && (
          <ComparisonTable data={comparison} />
        )}

      {/* Confirmation card */}
      {comparison && step === "comparison" && (
        <ConfirmationCard
          recommendation={comparison.recommended}
          skipped={comparison.skipped as SkippedItem[]}
          dish={dish}
          reasoning={comparison.reasoning}
          onConfirm={handleConfirmCheckout}
          onCancel={handleReset}
          loading={checkoutLoading}
        />
      )}

      {/* Error */}
      {step === "error" && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
          <h3 className="font-bold text-red-800 mb-2">Something went wrong</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm
                       font-medium hover:bg-red-600 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
