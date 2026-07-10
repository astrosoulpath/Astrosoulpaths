"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Page() {
  const [message, setMessage] = useState(
    "Checking Supabase connection...",
  );

  useEffect(() => {
    async function checkConnection() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setMessage(`Supabase error: ${error.message}`);
          return;
        }

        setMessage(
          data.session
            ? "Supabase connected. Active session found."
            : "Supabase connected successfully. No user is logged in yet.",
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? `Connection failed: ${error.message}`
            : "Connection failed.",
        );
      }
    }

    void checkConnection();
  }, []);

  return (
    <main className="min-h-screen bg-[#FAF7F0] p-10">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-[#0B1026]">
          Supabase Connection Test
        </h1>

        <p className="mt-4 text-gray-700">{message}</p>
      </div>
    </main>
  );
}