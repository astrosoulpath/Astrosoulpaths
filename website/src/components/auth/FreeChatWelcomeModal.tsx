"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type FreeChatData = {
  eligible: boolean;
  used: boolean;
  minutes: number;
  showPopup: boolean;
};

const FREE_CHAT_POPUP_EVENT = "asp-free-chat-popup";
const FREE_CHAT_STORAGE_KEY = "asp_free_chat_popup_pending";

export default function FreeChatWelcomeModal() {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [freeChat, setFreeChat] = useState<FreeChatData | null>(null);

  useEffect(() => {
    function openPendingPopup() {
      try {
        const pendingValue = sessionStorage.getItem(FREE_CHAT_STORAGE_KEY);

        const storedUserValue = localStorage.getItem("asp_user");

        if (!pendingValue || !storedUserValue) {
          return;
        }

        const pending = JSON.parse(pendingValue) as FreeChatData;

        const storedUser = JSON.parse(storedUserValue) as {
          role?: string;
          portal?: string;
        };

        const normalizedRole = storedUser.role?.trim().toUpperCase();

        const normalizedPortal = storedUser.portal?.trim().toLowerCase();

        const isCustomer =
          normalizedPortal === "customer" &&
          (normalizedRole === "CUSTOMER" || normalizedRole === "USER");

        const shouldShow =
          isCustomer &&
          pending.eligible === true &&
          pending.used === false &&
          pending.showPopup === true;

        if (shouldShow) {
          setFreeChat(pending);
          setIsOpen(true);
        }

        sessionStorage.removeItem(FREE_CHAT_STORAGE_KEY);
      } catch {
        sessionStorage.removeItem(FREE_CHAT_STORAGE_KEY);
      }
    }

    openPendingPopup();

    window.addEventListener(FREE_CHAT_POPUP_EVENT, openPendingPopup);

    return () => {
      window.removeEventListener(FREE_CHAT_POPUP_EVENT, openPendingPopup);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen || !freeChat) {
    return null;
  }

  function closePopup() {
    setIsOpen(false);
  }

  function startFreeChat() {
    setIsOpen(false);
    router.push("/astrologers");
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#050817]/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="free-chat-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          type="button"
          onClick={closePopup}
          aria-label="Close free chat popup"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20"
        >
          ×
        </button>

        <div className="bg-[#0B1026] px-8 pb-10 pt-9 text-center text-white">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#E0B326] text-3xl shadow-lg">
            ✨
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#E0B326]">
            Welcome to Astro Soul Path
          </p>

          <h2 id="free-chat-title" className="mt-3 text-3xl font-bold">
            Congratulations!
          </h2>

          <p className="mt-3 text-base text-white/80">
            Your first astrology consultation is on us.
          </p>
        </div>

        <div className="px-8 py-8 text-center">
          <div className="rounded-2xl border border-[#E0B326]/40 bg-[#FFF9E8] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#A77A00]">
              You have unlocked
            </p>

            <p className="mt-2 text-2xl font-extrabold text-[#0B1026]">
              1 FREE CHAT
            </p>

            <p className="mt-2 text-sm text-gray-600">
              Includes {freeChat.minutes} free{" "}
              {freeChat.minutes === 1 ? "minute" : "minutes"} with an eligible
              astrologer.
            </p>
          </div>

          <button
            type="button"
            onClick={startFreeChat}
            className="mt-6 w-full rounded-full bg-[#E0B326] px-6 py-3.5 font-bold text-[#0B1026] transition hover:bg-[#CFA31D]"
          >
            Chat with an Astrologer
          </button>

          <button
            type="button"
            onClick={closePopup}
            className="mt-3 w-full rounded-full px-6 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
