"use client";

import { useState, useRef, useEffect } from "react";
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step, recipe, comparison]);

  async function handleDishSubmit(inputDish: string, inputServings: number) {
    setDish(inputDish);
    setServings(inputServings);
    setError(null);
    setStep("recipe");
    try {
      const recipeResult = await decomposeRecipe(inputDish, inputServings);
      setRecipe(recipeResult);
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
    <div className="flex flex-col gap-5 pb-4">
      {/* Hero */}
      {step === "input" && (
        <div className="text-center pt-16 pb-8 animate-in">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-5">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-warm-50 tracking-tight mb-3">
            What are you cooking?
          </h1>
          <p className="text-warm-400 text-base max-w-md mx-auto leading-relaxed">
            Tell us the dish and servings. We&apos;ll find ingredients, compare
            prices, and handle checkout.
          </p>
        </div>
      )}

      {/* Input */}
      {step !== "done" && step !== "completing" && (
        <ChatInput
          onSubmit={handleDishSubmit}
          disabled={step !== "input" && step !== "error"}
        />
      )}

      {/* User message */}
      {dish && step !== "input" && (
        <div className="flex justify-end animate-in">
          <div className="glass glass-accent rounded-2xl rounded-br-md px-5 py-3 max-w-xs">
            <p className="text-warm-50 text-sm font-medium capitalize">{dish}</p>
            <p className="text-warm-600 text-xs mt-0.5">{servings} servings</p>
          </div>
        </div>
      )}

      {/* Loading: recipe */}
      {step === "recipe" && !recipe && (
        <LoadingSpinner message={`Breaking down ${dish} into ingredients`} />
      )}

      {/* Recipe */}
      {recipe && step !== "input" && (
        <div className="animate-in">
          <RecipeCard
            dish={recipe.dish}
            servings={recipe.servings}
            ingredients={recipe.ingredients}
            skipped={comparison?.skipped}
          />
        </div>
      )}

      {/* Loading: comparing */}
      {step === "comparing" && (
        <LoadingSpinner message="Comparing prices across Zepto & Swiggy" />
      )}

      {/* Comparison */}
      {comparison &&
        (step === "comparison" ||
          step === "confirmation" ||
          step === "prava_approval") && (
          <div className="animate-in">
            <ComparisonTable data={comparison} />
          </div>
        )}

      {/* Confirmation */}
      {comparison && step === "comparison" && (
        <div className="animate-in stagger-2">
          <ConfirmationCard
            recommendation={comparison.recommended}
            skipped={comparison.skipped as SkippedItem[]}
            dish={dish}
            reasoning={comparison.reasoning}
            onConfirm={handleConfirmCheckout}
            onCancel={handleReset}
            loading={checkoutLoading}
          />
        </div>
      )}

      {/* Prava */}
      {checkout && step === "prava_approval" && (
        <div className="animate-in">
          <PravaApproval
            paymentUrl={checkout.prava_payment_url || "#"}
            amount={comparison?.recommended?.total || 0}
            platform={comparison?.recommended?.platform || "zepto"}
            onComplete={handlePaymentComplete}
          />
        </div>
      )}

      {/* Completing */}
      {step === "completing" && (
        <LoadingSpinner message="Completing checkout with Prava credentials" />
      )}

      {/* Done */}
      {step === "done" && comparison && checkout && (
        <div className="animate-in">
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
        </div>
      )}

      {/* Error */}
      {step === "error" && error && (
        <div className="glass rounded-2xl p-6 animate-in" style={{ borderColor: "rgba(248,113,113,0.15)" }}>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-danger/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-warm-50 text-sm">
                Something went wrong
              </h3>
              <p className="text-warm-400 text-sm mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="mt-4 px-4 py-2 rounded-xl text-sm font-medium
                       bg-danger/10 text-danger hover:bg-danger/20 transition-colors"
          >
            Try again
          </button>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
