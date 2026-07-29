"use client";

import { useState } from "react";

import BusinessStep from "./steps/BusinessStep";
import LocationStep from "./steps/LocationStep";
import BranchStep from "./steps/BranchStep";
import OwnerStep from "./steps/OwnerStep";
import FinishStep from "./steps/FinishStep";

export default function SetupWizard() {
  const [step, setStep] = useState(1);

  function next() {
    setStep((prev) => Math.min(prev + 1, 5));
  }

  function back() {
    setStep((prev) => Math.max(prev - 1, 1));
  }

  return (
    <div className="space-y-8">

      {/* Progress */}

      <div>

        <div className="mb-3 flex justify-between text-sm text-zinc-400">

          <span>
            الخطوة {step} من 5
          </span>

          <span>
            {Math.round((step / 5) * 100)}%
          </span>

        </div>

        <div className="h-3 overflow-hidden rounded-full bg-zinc-800">

          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{
              width: `${(step / 5) * 100}%`,
            }}
          />

        </div>

      </div>

      {/* Steps */}

      {step === 1 && <BusinessStep />}
      {step === 2 && <LocationStep />}
      {step === 3 && <BranchStep />}
      {step === 4 && <OwnerStep />}
      {step === 5 && <FinishStep />}

      {/* Buttons */}

      <div className="flex justify-between">

        <button
          onClick={back}
          disabled={step === 1}
          className="rounded-xl border border-zinc-700 px-6 py-3 disabled:opacity-40"
        >
          ← السابق
        </button>

        {step < 5 ? (
          <button
            onClick={next}
            className="rounded-xl bg-blue-600 px-8 py-3 font-bold hover:bg-blue-700"
          >
            التالي →
          </button>
        ) : (
          <button
            className="rounded-xl bg-green-600 px-8 py-3 font-bold hover:bg-green-700"
          >
            ابدأ استخدام Octopus 🚀
          </button>
        )}

      </div>

    </div>
  );
}