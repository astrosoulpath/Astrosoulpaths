"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  sendAstrologerOtp,
} from "@/services/authService";


export function AstrologerLoginForm() {

  const router = useRouter();


  const [phone, setPhone] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");



  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>,
  ) {

    e.preventDefault();

    setError("");



    if (!phone.trim()) {

      setError(
        "Please enter phone number.",
      );

      return;
    }



    try {

      setLoading(true);



      await sendAstrologerOtp(
        phone,
      );



      const otpContext = {

        phone,

        flow: "login",

        portal: "astrologer",

        redirectTo:
          "/astrologer/dashboard",

      };



      localStorage.setItem(
        "asp_otp_context",
        JSON.stringify(
          otpContext,
        ),
      );



      router.push(
        "/verify-otp",
      );


    } catch (error: unknown) {


      setError(
        error instanceof Error
          ? error.message
          : "Astrologer login failed.",
      );


    } finally {

      setLoading(false);

    }

  }



  return (

    <main
      className="
        min-h-screen
        flex
        items-center
        justify-center
        bg-[#FAF7F0]
        px-6
      "
    >

      <div
        className="
          w-full
          max-w-md
          rounded-3xl
          bg-white
          p-8
          shadow-lg
        "
      >


        <h1
          className="
            text-3xl
            font-bold
            text-[#0B1026]
          "
        >
          Astrologer Login
        </h1>


        <p
          className="
            mt-3
            text-gray-600
          "
        >
          Login to manage your consultations,
          earnings and availability.
        </p>



        {
          error && (

            <div
              className="
                mt-5
                rounded-xl
                bg-red-50
                p-4
                text-red-600
              "
            >
              {error}
            </div>

          )
        }



        <form
          onSubmit={handleSubmit}
          className="
            mt-8
            space-y-5
          "
        >


          <input

            type="tel"

            value={phone}

            onChange={
              (e)=>
                setPhone(
                  e.target.value
                )
            }

            placeholder="+91XXXXXXXXXX"

            className="
              w-full
              rounded-xl
              border
              p-4
              outline-none
              focus:border-[#D4AF37]
            "

          />



          <button

            type="submit"

            disabled={loading}

            className="
              w-full
              rounded-xl
              bg-[#D4AF37]
              py-4
              font-semibold
              text-[#0B1026]
              disabled:opacity-60
            "

          >

            {
              loading
              ? "Sending OTP..."
              : "Continue"
            }


          </button>


        </form>


      </div>


    </main>

  );

}