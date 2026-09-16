"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

type KycDocument = {
  type?: string | null;
  name?: string | null;
  path?: string | null;
  signedUrl?: string | null;
  error?: string | null;
};

type AstrologerDetails = {
  id: string;

  bio?: string | null;
  experience?: number | null;
  pricePerMin?: number | null;
  rating?: number | null;
  totalReviews?: number;

  isApproved: boolean;
  isVerified: boolean;
  isOnline: boolean;

  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;

    userProfile?: {
      fullName?: string | null;
      avatarUrl?: string | null;
    } | null;
  } | null;

  expertise?: Array<{
    expertise?: {
      id?: string;
      name?: string;
    };
  }>;
};

type KycResponse = {
  success: boolean;

  data: {
    astrologerId: string;

    identityProof: KycDocument | null;

    certificates: KycDocument[];

    experienceProofs: KycDocument[];

    expiresInSeconds: number;
  };
};

function getAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.localStorage.getItem(
      "asp_access_token",
    ) ??
    window.localStorage.getItem(
      "access_token",
    )
  );
}

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message;
  }

  return "Unable to load astrologer details.";
}

export default function AdminAstrologerDetailPage() {
  const params = useParams<{
    id: string;
  }>();

  const router = useRouter();

  const astrologerId =
    typeof params?.id === "string"
      ? params.id
      : "";

  const [
    astrologer,
    setAstrologer,
  ] =
    useState<AstrologerDetails | null>(
      null,
    );

  const [
    kyc,
    setKyc,
  ] =
    useState<KycResponse["data"] | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState<string | null>(null);

  const [
    updatingAction,
    setUpdatingAction,
  ] =
    useState<string | null>(null);

  async function fetchWithAuth(
    path: string,
    init?: RequestInit,
  ) {
    const token =
      getAccessToken();

    if (!token) {
      throw new Error(
        "Admin login token is missing. Please log in again.",
      );
    }

    const response =
      await fetch(
        `${API_BASE_URL.replace(
          /\/+$/,
          "",
        )}${path}`,
        {
          ...init,

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",

            ...(init?.headers ?? {}),
          },
        },
      );

    const data =
      await response
        .json()
        .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.message ??
          `Request failed with status ${response.status}.`,
      );
    }

    return data;
  }

  async function loadData() {
    if (!astrologerId) {
      setErrorMessage(
        "Astrologer ID is missing.",
      );

      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const [
        astrologerResponse,
        kycResponse,
      ] =
        await Promise.all([
          fetchWithAuth(
            `/admin/astrologers/${encodeURIComponent(
              astrologerId,
            )}`,
          ),

          fetchWithAuth(
            `/admin/astrologers/${encodeURIComponent(
              astrologerId,
            )}/kyc`,
          ),
        ]);

      setAstrologer(
        astrologerResponse?.data ??
          null,
      );

      setKyc(
        kycResponse?.data ??
          null,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [astrologerId]);

  async function updateAstrologer(
    action:
      | "approve"
      | "reject"
      | "suspend",
  ) {
    if (!astrologerId) {
      return;
    }

    try {
      setUpdatingAction(action);
      setErrorMessage(null);

      await fetchWithAuth(
        `/admin/astrologers/${encodeURIComponent(
          astrologerId,
        )}/${action}`,
        {
          method: "PATCH",
        },
      );

      await loadData();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setUpdatingAction(null);
    }
  }

  function openDocument(
    document:
      | KycDocument
      | null
      | undefined,
  ) {
    if (!document?.signedUrl) {
      return;
    }

    window.open(
      document.signedUrl,
      "_blank",
      "noopener,noreferrer",
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#F8F8F8] px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-lg font-semibold text-gray-600">
            Loading astrologer details...
          </p>
        </div>
      </main>
    );
  }

  if (
    errorMessage &&
    !astrologer
  ) {
    return (
      <main className="min-h-screen bg-[#F8F8F8] px-6 py-12">
        <div className="mx-auto max-w-6xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-600">
            {errorMessage}
          </p>
        </div>
      </main>
    );
  }

  const displayName =
    astrologer?.user?.userProfile
      ?.fullName?.trim() ||
    astrologer?.user?.name?.trim() ||
    astrologer?.user?.email?.trim() ||
    astrologer?.user?.phone?.trim() ||
    "Astrologer";

  return (
    <main className="min-h-screen bg-[#F8F8F8] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin/astrologers",
            )
          }
          className="mb-6 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700"
        >
          ← Back to Astrologers
        </button>

        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
                Astrologer Review
              </p>

              <h1 className="mt-2 text-3xl font-extrabold text-[#0B1026]">
                {displayName}
              </h1>

              <div className="mt-4 space-y-1 text-sm text-gray-600">
                <p>
                  Email:{" "}
                  {astrologer?.user
                    ?.email ??
                    "Not provided"}
                </p>

                <p>
                  Phone:{" "}
                  {astrologer?.user
                    ?.phone ??
                    "Not provided"}
                </p>

                <p>
                  Experience:{" "}
                  {astrologer?.experience ??
                    0}{" "}
                  years
                </p>

                <p>
                  Price: ₹
                  {Number(
                    astrologer?.pricePerMin ??
                      0,
                  ).toFixed(2)}
                  /min
                </p>

                <p>
                  Rating:{" "}
                  {Number(
                    astrologer?.rating ??
                      0,
                  ).toFixed(1)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {!astrologer?.isApproved ||
              !astrologer?.isVerified ? (
                <>
                  <button
                    type="button"
                    disabled={
                      updatingAction !==
                      null
                    }
                    onClick={() =>
                      void updateAstrologer(
                        "approve",
                      )
                    }
                    className="rounded-xl bg-green-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {updatingAction ===
                    "approve"
                      ? "Approving..."
                      : "Approve"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      updatingAction !==
                      null
                    }
                    onClick={() =>
                      void updateAstrologer(
                        "reject",
                      )
                    }
                    className="rounded-xl bg-gray-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {updatingAction ===
                    "reject"
                      ? "Rejecting..."
                      : "Reject"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={
                    updatingAction !== null
                  }
                  onClick={() =>
                    void updateAstrologer(
                      "suspend",
                    )
                  }
                  className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {updatingAction ===
                  "suspend"
                    ? "Suspending..."
                    : "Suspend"}
                </button>
              )}
            </div>
          </div>

          {astrologer?.bio ? (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h2 className="text-lg font-bold text-[#0B1026]">
                Professional Bio
              </h2>

              <p className="mt-3 leading-7 text-gray-600">
                {astrologer.bio}
              </p>
            </div>
          ) : null}

          <div className="mt-8 border-t border-gray-200 pt-6">
            <h2 className="text-lg font-bold text-[#0B1026]">
              Expertise
            </h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {astrologer?.expertise
                ?.length ? (
                astrologer.expertise.map(
                  (
                    item,
                    index,
                  ) => (
                    <span
                      key={
                        item.expertise
                          ?.id ??
                        index
                      }
                      className="rounded-full bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800"
                    >
                      {item.expertise
                        ?.name ??
                        "Expertise"}
                    </span>
                  ),
                )
              ) : (
                <p className="text-sm text-gray-500">
                  No expertise listed.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">
              KYC Verification
            </p>

            <h2 className="mt-2 text-2xl font-extrabold text-[#0B1026]">
              Submitted Documents
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Document links are temporary
              and expire after{" "}
              {kyc?.expiresInSeconds
                ? Math.floor(
                    kyc.expiresInSeconds /
                      60,
                  )
                : 10}{" "}
              minutes.
            </p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-[#0B1026]">
                Identity Proof
              </h3>

              {kyc?.identityProof ? (
                <>
                  <p className="mt-3 break-all text-sm text-gray-600">
                    {kyc.identityProof
                      .name ??
                      "Identity document"}
                  </p>

                  {kyc.identityProof
                    .signedUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        openDocument(
                          kyc.identityProof,
                        )
                      }
                      className="mt-4 rounded-lg bg-[#0B1026] px-4 py-2 text-sm font-bold text-white"
                    >
                      View Document
                    </button>
                  ) : (
                    <p className="mt-3 text-sm font-semibold text-red-600">
                      Document unavailable.
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  No identity proof submitted.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-[#0B1026]">
                Certificates
              </h3>

              <div className="mt-3 space-y-3">
                {kyc?.certificates
                  ?.length ? (
                  kyc.certificates.map(
                    (
                      document,
                      index,
                    ) => (
                      <div
                        key={
                          document.path ??
                          index
                        }
                        className="rounded-xl bg-gray-50 p-3"
                      >
                        <p className="break-all text-sm text-gray-600">
                          {document.name ??
                            `Certificate ${
                              index + 1
                            }`}
                        </p>

                        {document.signedUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              openDocument(
                                document,
                              )
                            }
                            className="mt-2 text-sm font-bold text-blue-700"
                          >
                            View
                          </button>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-red-600">
                            Unavailable
                          </p>
                        )}
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-gray-500">
                    No certificates submitted.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-[#0B1026]">
                Experience Proof
              </h3>

              <div className="mt-3 space-y-3">
                {kyc
                  ?.experienceProofs
                  ?.length ? (
                  kyc.experienceProofs.map(
                    (
                      document,
                      index,
                    ) => (
                      <div
                        key={
                          document.path ??
                          index
                        }
                        className="rounded-xl bg-gray-50 p-3"
                      >
                        <p className="break-all text-sm text-gray-600">
                          {document.name ??
                            `Experience proof ${
                              index + 1
                            }`}
                        </p>

                        {document.signedUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              openDocument(
                                document,
                              )
                            }
                            className="mt-2 text-sm font-bold text-blue-700"
                          >
                            View
                          </button>
                        ) : (
                          <p className="mt-2 text-xs font-semibold text-red-600">
                            Unavailable
                          </p>
                        )}
                      </div>
                    ),
                  )
                ) : (
                  <p className="text-sm text-gray-500">
                    No experience proof submitted.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}