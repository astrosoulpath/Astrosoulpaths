"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type WalletTransaction = {
  id: string;
  type: "credit" | "debit";
  title: string;
  amount: number;
  date: string;
};

const demoTransactions: WalletTransaction[] = [];

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] =
    useState<WalletTransaction[]>(demoTransactions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedBalance = localStorage.getItem("asp_wallet_balance");

    if (storedBalance) {
      const parsedBalance = Number(storedBalance);

      if (Number.isFinite(parsedBalance)) {
        setBalance(parsedBalance);
      }
    }

    const storedTransactions = localStorage.getItem(
      "asp_wallet_transactions",
    );

    if (storedTransactions) {
      try {
        const parsedTransactions = JSON.parse(
          storedTransactions,
        ) as WalletTransaction[];

        if (Array.isArray(parsedTransactions)) {
          setTransactions(parsedTransactions);
        }
      } catch {
        localStorage.removeItem("asp_wallet_transactions");
      }
    }

    setLoading(false);
  }, []);

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold text-[#D4AF37]">
              My Wallet
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#0B1026]">
              Manage your consultation balance
            </h1>

            <p className="mt-4 max-w-2xl text-gray-600">
              Add money to your wallet and use it for chat and
              audio-call consultations with verified astrologers.
            </p>
          </div>

          <Link
            href="/astrologers"
            className="inline-flex rounded-xl border border-[#0B1026] px-5 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white"
          >
            Browse Astrologers
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 rounded-3xl bg-white p-10 text-center shadow-lg">
            Loading wallet...
          </div>
        ) : (
          <>
            <section className="mt-10 grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="rounded-3xl bg-[#0B1026] p-8 text-white shadow-xl">
                <p className="text-sm font-semibold text-[#D4AF37]">
                  Available Balance
                </p>

                <p className="mt-4 text-5xl font-bold">
                  ₹{balance.toFixed(2)}
                </p>

                <p className="mt-4 max-w-xl text-gray-300">
                  Your wallet balance will be used automatically when
                  a consultation starts.
                </p>
              </div>

              <div className="rounded-3xl bg-white p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-[#0B1026]">
                  Add Money
                </h2>

                <p className="mt-2 text-gray-600">
                  Recharge your wallet securely before starting a
                  consultation.
                </p>

                <Link
                  href="/wallet/recharge"
                  className="mt-6 inline-flex w-full justify-center rounded-xl bg-[#D4AF37] px-6 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F]"
                >
                  Recharge Wallet
                </Link>
              </div>
            </section>

            <section className="mt-8 rounded-3xl bg-white p-8 shadow-lg">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#0B1026]">
                    Transaction History
                  </h2>

                  <p className="mt-1 text-gray-600">
                    Review your wallet recharges and consultation
                    deductions.
                  </p>
                </div>
              </div>

              {transactions.length === 0 ? (
                <div className="mt-8 rounded-2xl border border-dashed bg-[#FAF7F0] p-10 text-center">
                  <h3 className="text-lg font-bold text-[#0B1026]">
                    No transactions yet
                  </h3>

                  <p className="mt-2 text-gray-600">
                    Your recharge and consultation activity will
                    appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-8 space-y-4">
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-[#0B1026]">
                          {transaction.title}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {transaction.date}
                        </p>
                      </div>

                      <p
                        className={`text-lg font-bold ${
                          transaction.type === "credit"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "credit" ? "+" : "-"}₹
                        {transaction.amount.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}