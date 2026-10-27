"use client";
import { ModerationDialog, type ModerationAction } from '@/features/admin/moderation/ModerationDialog';

import { adminFetch } from "@/features/admin/auth/admin-session";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";



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

  const fetchWithAuth = useCallback(async function fetchWithAuth(
    path: string,
    init?: RequestInit,
  ) {

    const response =
      await adminFetch(
        `${path}`,
        {
          ...init,

          headers: {

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
  }, []);

  const loadData = useCallback(async function loadData() {
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
  }, [astrologerId, fetchWithAuth]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const [moderation,setModeration]=useState<ModerationAction|null>(null);

  async function updateAstrologer(action:'approve'|'reject'|'suspend') {if(astrologerId)setModeration(action.toUpperCase() as ModerationAction);}

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
      {moderation && <ModerationDialog kind="astrologers" id={astrologerId} action={moderation} onClose={()=>setModeration(null)} onDone={()=>{setModeration(null);setUpdatingAction(null);void loadData();}} />}
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

              <h2 className="mt-2 text-3xl font-semibold text-[#0B1026]">
                {displayName}
              </h2>

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
                  {astrologer?.experience == null ? "Unavailable" : `${astrologer.experience} years`}
                </p>

                <p>
                  Price:{" "}
                  {astrologer?.pricePerMin == null ? "Unavailable" : `\u20B9${Number(astrologer.pricePerMin).toFixed(2)}/min`}
                </p>

                <p>
                  Rating:{" "}
                  {astrologer?.rating == null ? "Unavailable" : Number(astrologer.rating).toFixed(1)}
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
                    className="rounded-xl bg-[#10233D] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
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
                <p className="text-sm text-[#52627A]">
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

            <h2 className="mt-2 text-2xl font-semibold text-[#0B1026]">
              Submitted Documents
            </h2>

            <p className="mt-2 text-sm text-[#52627A]">
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
                <p className="mt-3 text-sm text-[#52627A]">
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
                  <p className="text-sm text-[#52627A]">
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
                  <p className="text-sm text-[#52627A]">
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
