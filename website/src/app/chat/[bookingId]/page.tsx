"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type ChatMessage = {
  id: string;
  sender: "user" | "astrologer";
  message: string;
  createdAt: string;
};

type LocalBooking = {
  id: string;
  astrologerId: string;
  astrologerName?: string;
  mode: "chat" | "audio";
  pricePerMin: number;
  status: "active" | "completed";
  createdAt: string;
  endedAt?: string;
  durationSeconds?: number;
  billedMinutes?: number;
  totalCharge?: number;
};

type WalletTransaction = {
  id: string;
  type: "credit" | "debit";
  title: string;
  amount: number;
  date: string;
};

function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readBookings(): LocalBooking[] {
  const value = localStorage.getItem("asp_consultation_bookings");

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as LocalBooking[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readWalletBalance(): number {
  const value = Number(
    localStorage.getItem("asp_wallet_balance") ?? "0",
  );

  return Number.isFinite(value) && value > 0 ? value : 0;
}

function readWalletTransactions(): WalletTransaction[] {
  const value = localStorage.getItem(
    "asp_wallet_transactions",
  );

  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as WalletTransaction[];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ChatConsultationPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();

  const bookingId = params.bookingId;

  const [booking, setBooking] =
    useState<LocalBooking | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);

  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState("");

  const endProcessedRef = useRef(false);
  const messagesContainerRef =
    useRef<HTMLDivElement | null>(null);

  const messagesStorageKey = useMemo(
    () => `asp_chat_messages_${bookingId}`,
    [bookingId],
  );

  useEffect(() => {
    const token = localStorage.getItem("asp_access_token");

    if (!token) {
      router.replace(
        `/login?redirect=${encodeURIComponent(
          `/chat/${bookingId}`,
        )}`,
      );
      return;
    }

    const matchedBooking = readBookings().find(
      (item) => item.id === bookingId,
    );

    if (!matchedBooking) {
      setError("Consultation booking was not found.");
      setLoading(false);
      return;
    }

    if (matchedBooking.mode !== "chat") {
      setError("This booking is not a chat consultation.");
      setLoading(false);
      return;
    }

    setBooking(matchedBooking);
    setWalletBalance(readWalletBalance());

    const startedAt = new Date(
      matchedBooking.createdAt,
    ).getTime();

    if (
      Number.isFinite(startedAt) &&
      matchedBooking.status === "active"
    ) {
      setSeconds(
        Math.max(
          0,
          Math.floor((Date.now() - startedAt) / 1000),
        ),
      );
    } else {
      setSeconds(matchedBooking.durationSeconds ?? 0);
    }

    const storedMessages = localStorage.getItem(
      messagesStorageKey,
    );

    if (storedMessages) {
      try {
        const parsedMessages = JSON.parse(
          storedMessages,
        ) as ChatMessage[];

        if (Array.isArray(parsedMessages)) {
          setMessages(parsedMessages);
        }
      } catch {
        localStorage.removeItem(messagesStorageKey);
      }
    }

    setLoading(false);
  }, [bookingId, messagesStorageKey, router]);

  useEffect(() => {
    if (!booking || booking.status !== "active") {
      return;
    }

    const timer = window.setInterval(() => {
      setSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [booking]);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }, [seconds]);

  const billedMinutes = useMemo(() => {
    return Math.max(1, Math.ceil(seconds / 60));
  }, [seconds]);

  const estimatedCharge = useMemo(() => {
    if (!booking) {
      return 0;
    }

    return billedMinutes * booking.pricePerMin;
  }, [billedMinutes, booking]);

  function saveMessages(nextMessages: ChatMessage[]) {
    setMessages(nextMessages);

    localStorage.setItem(
      messagesStorageKey,
      JSON.stringify(nextMessages),
    );
  }

  function handleSendMessage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const normalizedMessage = message.trim();

    if (
      !normalizedMessage ||
      !booking ||
      booking.status !== "active"
    ) {
      return;
    }

    const newMessage: ChatMessage = {
      id: createId(),
      sender: "user",
      message: normalizedMessage,
      createdAt: new Date().toISOString(),
    };

    saveMessages([...messages, newMessage]);
    setMessage("");
  }

  function completeBooking(totalCharge: number) {
    if (!booking) {
      return;
    }

    const completedBooking: LocalBooking = {
      ...booking,
      status: "completed",
      endedAt: new Date().toISOString(),
      durationSeconds: seconds,
      billedMinutes,
      totalCharge,
    };

    const updatedBookings = readBookings().map((item) =>
      item.id === booking.id ? completedBooking : item,
    );

    localStorage.setItem(
      "asp_consultation_bookings",
      JSON.stringify(updatedBookings),
    );

    setBooking(completedBooking);
  }

  function deductWallet(totalCharge: number): number {
    if (!booking) {
      return 0;
    }

    const currentBalance = readWalletBalance();
    const deductedAmount = Math.min(
      currentBalance,
      totalCharge,
    );

    const updatedBalance = Math.max(
      0,
      currentBalance - deductedAmount,
    );

    localStorage.setItem(
      "asp_wallet_balance",
      String(updatedBalance),
    );

    const transaction: WalletTransaction = {
      id: createId(),
      type: "debit",
      title: `Chat consultation${
        booking.astrologerName
          ? ` with ${booking.astrologerName}`
          : ""
      }`,
      amount: deductedAmount,
      date: new Date().toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };

    localStorage.setItem(
      "asp_wallet_transactions",
      JSON.stringify([
        transaction,
        ...readWalletTransactions(),
      ]),
    );

    setWalletBalance(updatedBalance);

    return deductedAmount;
  }

  function handleEndConsultation() {
    if (
      !booking ||
      booking.status !== "active" ||
      ending ||
      endProcessedRef.current
    ) {
      return;
    }

    const shouldEnd = window.confirm(
      `End this chat?\n\nDuration: ${formattedTime}\nBilled minutes: ${billedMinutes}\nCharge: ₹${estimatedCharge.toFixed(
        2,
      )}`,
    );

    if (!shouldEnd) {
      return;
    }

    try {
      setEnding(true);
      endProcessedRef.current = true;

      const deductedAmount = deductWallet(
        estimatedCharge,
      );

      completeBooking(deductedAmount);

      localStorage.removeItem(
        "asp_pending_consultation",
      );

      router.replace("/wallet");
    } catch (err: unknown) {
      endProcessedRef.current = false;

      setError(
        err instanceof Error
          ? err.message
          : "Unable to end consultation.",
      );
    } finally {
      setEnding(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-6 py-20">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-10 text-center shadow-lg">
          Loading consultation...
        </div>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="min-h-screen bg-[#FAF7F0] px-6 py-20">
        <div className="mx-auto max-w-4xl rounded-3xl bg-red-50 p-8 text-red-700 shadow-lg">
          <h1 className="text-2xl font-bold">
            Unable to open consultation
          </h1>

          <p className="mt-3">
            {error || "Booking not found."}
          </p>

          <Link
            href="/astrologers"
            className="mt-6 inline-flex rounded-xl border border-red-300 px-5 py-3 font-semibold"
          >
            Browse Astrologers
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF7F0] px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <section className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <header className="flex flex-col gap-5 bg-[#0B1026] p-6 text-white lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#D4AF37]">
                Chat Consultation
              </p>

              <h1 className="mt-1 text-2xl font-bold">
                {booking.astrologerName ||
                  "Astro Soul Path Astrologer"}
              </h1>

              <p className="mt-1 text-sm text-gray-300">
                ₹{booking.pricePerMin}/minute
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center">
              <div className="rounded-xl bg-white/10 px-4 py-2">
                <p className="text-xs text-gray-300">
                  Session Time
                </p>
                <p className="font-bold">{formattedTime}</p>
              </div>

              <div className="rounded-xl bg-white/10 px-4 py-2">
                <p className="text-xs text-gray-300">
                  Estimated Charge
                </p>
                <p className="font-bold">
                  ₹{estimatedCharge.toFixed(2)}
                </p>
              </div>

              <div className="rounded-xl bg-white/10 px-4 py-2">
                <p className="text-xs text-gray-300">
                  Wallet
                </p>
                <p className="font-bold">
                  ₹{walletBalance.toFixed(2)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleEndConsultation}
                disabled={
                  ending || booking.status !== "active"
                }
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {ending ? "Ending..." : "End Chat"}
              </button>
            </div>
          </header>

          {booking.status === "completed" && (
            <div className="border-b bg-green-50 p-4 text-center font-semibold text-green-700">
              This consultation has ended.
            </div>
          )}

          <div
            ref={messagesContainerRef}
            className="h-[480px] overflow-y-auto bg-[#FAF7F0] p-6"
          >
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <h2 className="text-xl font-bold text-[#0B1026]">
                    Consultation started
                  </h2>

                  <p className="mt-2 text-gray-600">
                    Send your first message to the astrologer.
                  </p>

                  <p className="mt-3 text-sm text-gray-500">
                    Billing is calculated per started minute.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`flex ${
                      item.sender === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                        item.sender === "user"
                          ? "bg-[#D4AF37] text-[#0B1026]"
                          : "bg-white text-[#0B1026] shadow"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {item.message}
                      </p>

                      <p className="mt-1 text-right text-xs opacity-60">
                        {new Date(
                          item.createdAt,
                        ).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="flex gap-3 border-t p-5"
          >
            <input
              type="text"
              value={message}
              disabled={booking.status !== "active"}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder={
                booking.status === "active"
                  ? "Type your message..."
                  : "Consultation has ended"
              }
              className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-[#D4AF37] disabled:bg-gray-100"
            />

            <button
              type="submit"
              disabled={
                !message.trim() ||
                booking.status !== "active"
              }
              className="rounded-xl bg-[#D4AF37] px-7 py-3 font-semibold text-[#0B1026] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}