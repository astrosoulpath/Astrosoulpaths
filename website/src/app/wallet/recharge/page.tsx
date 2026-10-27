"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

import { walletPayment } from "@/features/wallet/wallet-payment";

const presetAmounts = [100, 250, 500, 1000];

export default function WalletRechargePage() {
  const [amount, setAmount] = useState(250);
  const [customAmount, setCustomAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const reset = () => {active.current?.abort(); setLoading(false); setMessage(""); setError("");};
    window.addEventListener('asp-auth-changed', reset);
    window.addEventListener('storage', reset);
    return () => {active.current?.abort(); window.removeEventListener('asp-auth-changed', reset); window.removeEventListener('storage', reset);};
  }, []);

  function getSelectedAmount() {
    const customValue = Number(customAmount);

    if (customAmount.trim()) {
      return Number.isFinite(customValue) ? customValue : 0;
    }

    return amount;
  }

  function handlePresetAmount(value: number) {
    setAmount(value);
    setCustomAmount("");
    setError("");
    setMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    await runPayment('checkout');
  }

  async function runPayment(action: 'checkout' | 'status') {
    if (busy.current) return;

    setError("");
    setMessage("");

    const rechargeAmount = getSelectedAmount();

    if (action === 'checkout' && (
      !Number.isFinite(rechargeAmount) ||
      rechargeAmount < 50
    )) {
      setError("Minimum recharge amount is ₹50.");
      return;
    }

    if (action === 'checkout' && rechargeAmount > 50000) {
      setError("Maximum recharge amount is ₹50,000.");
      return;
    }

    try {
      busy.current = true;
      const controller = new AbortController();
      active.current = controller;
      setLoading(true);
      const state = await walletPayment(action, rechargeAmount, controller.signal);
      if (controller.signal.aborted) return;
      setMessage(state === 'SUCCESS' ? 'Payment verified by the server. Your wallet has been credited. View your updated wallet below.' :
        state === 'PENDING' ? 'Payment is pending. Check status before paying again.' :
        state === 'CANCELLED' ? 'Checkout closed. No payment success has been confirmed. Check status or resume the existing checkout.' :
        'Payment failed. Check status before resuming the existing checkout.');
    } catch (error) {
      if (active.current?.signal.aborted) return;
      setError(
        error instanceof Error
          ? error.message
          : "Unable to recharge wallet. Please try again.",
      );
    } finally {
      busy.current = false;
      if (!active.current?.signal.aborted) setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/wallet"
          className="font-semibold text-[#0B1026] underline"
        >
          ← Back to Wallet
        </Link>

        <section className="mt-8 rounded-3xl bg-white p-8 shadow-lg sm:p-10">
          <p className="font-semibold text-[#D4AF37]">
            Wallet Recharge
          </p>

          <h1 className="mt-3 text-4xl font-bold text-[#0B1026]">
            Add money to your wallet
          </h1>

          <p className="mt-4 text-gray-600">
            Select an amount to use for chat and audio-call
            consultations.
          </p>

          {error && (
            <div role="alert" className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div role="status" className="mt-6 rounded-xl bg-amber-50 p-4 text-slate-800">
              <p className="font-semibold">{message}</p>

              <Link
                href="/wallet"
                className="mt-2 inline-block underline"
              >
                View updated wallet
              </Link>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="mt-8"
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {presetAmounts.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    handlePresetAmount(value)
                  }
                  className={`rounded-2xl border px-5 py-5 text-xl font-bold transition ${
                    !customAmount && amount === value
                      ? "border-[#D4AF37] bg-[#D4AF37]/15 text-[#0B1026]"
                      : "border-gray-300 bg-white text-[#0B1026] hover:border-[#D4AF37]"
                  }`}
                >
                  ₹{value}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label
                htmlFor="custom-amount"
                className="mb-2 block text-sm font-semibold text-[#0B1026]"
              >
                Custom amount
              </label>

              <div className="flex items-center rounded-xl border border-gray-300 bg-white px-4 focus-within:border-[#D4AF37]">
                <span className="font-bold text-gray-500">
                  ₹
                </span>

                <input
                  id="custom-amount"
                  type="number"
                  min="50"
                  max="50000"
                  step="0.01"
                  value={customAmount}
                  onChange={(event) => {
                    setCustomAmount(
                      event.target.value,
                    );
                    setError("");
                    setMessage("");
                  }}
                  placeholder="Enter amount"
                  className="w-full bg-transparent px-3 py-4 outline-none"
                />
              </div>
            </div>

            <div className="mt-8 rounded-2xl bg-[#FAF7F0] p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-gray-600">
                  Recharge amount
                </span>

                <strong className="text-xl text-[#0B1026]">
                  ₹{getSelectedAmount().toFixed(2)}
                </strong>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Processing..."
                : `Add ₹${getSelectedAmount().toFixed(
                    2,
                  )}`}
            </button>

            <button type="button" disabled={loading} onClick={() => void runPayment('status')} className="mt-4 font-semibold underline disabled:opacity-50">Check pending payment status</button>
            <p className="mt-4 text-center text-xs text-gray-500">Only server-verified payments credit your wallet. If interrupted, check status before retrying. Continuing with a pending order resumes that existing checkout.</p>
          </form>
        </section>
      </div>
    </main>
  );
}
