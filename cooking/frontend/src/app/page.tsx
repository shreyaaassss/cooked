"use client";

import { useState } from "react";
import ChatInput from "@/components/ChatInput";
import RecipeCard from "@/components/RecipeCard";
import ComparisonTable from "@/components/ComparisonTable";
import ConfirmationCard from "@/components/ConfirmationCard";
import PravaApproval from "@/components/PravaApproval";
import OrderStatus from "@/components/OrderStatus";
import LoadingSpinner from "@/components/LoadingSpinner";
import {
  comparePrices,
  completeCheckout,
  decomposeRecipe,
  initiateCheckout,
} from "@/lib/api";
import type {
  AppStep,
  CheckoutInitResult,
  CompareResult,
  RecipeResult,
  SkippedItem,
} from "@/lib/types";

export default function Home() {
  const [step, setStep] = useState<AppStep>("input");
  const [dish, setDish] = useState("");
  const [servings, setServings] = useState(4);
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [comparison, setComparison] = useState<CompareResult | null>(null);
  const [checkout, setCheckout] = useState<CheckoutInitResult | null>(null);
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

  async function handleConfirmCheckout() {
    if (!comparison?.recommended) return;
    setCheckoutLoading(true);

    try {
      const result = await initiateCheckout({
        platform: comparison.recommended.platform || "zepto",
        cart_items: comparison.recommended.items,
        total_amount: comparison.recommended.total,
        source_recipe: `${dish}, serves ${servings}`,
        skipped_items: comparison.skipped,
      });
      setCheckout(result);
      setStep("prava_approval");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setStep("error");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handlePaymentComplete() {
    if (!checkout?.order_id) return;
    setStep("completing");

    try {
      await completeCheckout(checkout.order_id);
      setStep("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Payment completion failed"
      );
      setStep("error");
    }
  }

  function handleReset() {
    setStep("input");
    setDish("");
    setServings(4);
    setRecipe(null);
    setComparison(null);
    setCheckout(null);
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
      {step !== "done" && step !== "completing" && (
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
        (step === "comparison" || step === "confirmation" || step === "prava_approval") && (
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

      {/* Prava approval */}
      {checkout && step === "prava_approval" && (
        <PravaApproval
          paymentUrl={checkout.prava_payment_url || "#"}
          amount={comparison?.recommended?.total || 0}
          platform={comparison?.recommended?.platform || "zepto"}
          onComplete={handlePaymentComplete}
        />
      )}

      {/* Completing checkout */}
      {step === "completing" && (
        <LoadingSpinner message="Completing checkout with your Prava credentials..." />
      )}

      {/* Order complete */}
      {step === "done" && comparison && checkout && (
        <OrderStatus
          orderId={checkout.order_id}
          dish={dish}
          platform={comparison.recommended.platform || "zepto"}
          items={comparison.recommended.items}
          skipped={comparison.skipped as SkippedItem[]}
          total={comparison.recommended.total}
          status="paid"
          eta={comparison.recommended.eta}
          onNewOrder={handleReset}
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
