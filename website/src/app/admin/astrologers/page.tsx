"use client";
import { ModerationDialog, type ModerationAction } from '@/features/admin/moderation/ModerationDialog';
﻿

import { adminFetch } from "@/features/admin/auth/admin-session";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";



type AdminAstrologer = {
  id: string;
  userId: string;
  bio?: string | null;
  languages?: string[];
  experience?: number | null;
  pricePerMin?: number | null;
  rating?: number | null;
  totalReviews?: number;
  isApproved: boolean;
  isVerified: boolean;
  isOnline: boolean;
  profileUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;

  user?: {
    id?: string;
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
    } | null;
  }>;
};

type AdminAstrologersResponse = {
  success: boolean;
  data: AdminAstrologer[];
  pagination?: { totalPages?: number };
  message?: string;
};

type StatusFilter =
  | "ALL"
  | "PENDING"
  | "APPROVED"
  | "SUSPENDED"
  | "ONLINE";

function getAstrologerName(astrologer: AdminAstrologer) {
  return (
    astrologer.user?.userProfile?.fullName?.trim() ||
    astrologer.user?.email?.trim() ||
    astrologer.user?.phone?.trim() ||
    "Astro Soul Path Astrologer"
  );
}

function getExpertise(astrologer: AdminAstrologer) {
  const values =
    astrologer.expertise
      ?.map((item) => item.expertise?.name?.trim())
      .filter(
        (item): item is string =>
          typeof item === "string" && Boolean(item),
      ) ?? [];

  return values.length ? values.join(", ") : "Not specified";
}

function getStatusLabel(astrologer: AdminAstrologer) {
  if (
    astrologer.isApproved &&
    astrologer.isVerified
  ) {
    return "Approved";
  }

  if (
    !astrologer.isApproved &&
    !astrologer.isVerified
  ) {
    return "Not approved";
  }

  return "Review required";
}

function getStatusClasses(astrologer: AdminAstrologer) {
  if (
    astrologer.isApproved &&
    astrologer.isVerified
  ) {
    return "border-green-200 bg-green-100 text-green-700";
  }

  if (
    !astrologer.isApproved &&
    !astrologer.isVerified
  ) {
    return "border-amber-200 bg-amber-100 text-amber-700";
  }

  return "border-red-200 bg-red-100 text-red-700";
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to load astrologers.";
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

export default function AdminAstrologersPage() {
  const [astrologers, setAstrologers] = useState<
    AdminAstrologer[]
  >([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] =
    useState(false);
  const [updatingId, setUpdatingId] = useState<
    string | null
  >(null);

  const [errorMessage, setErrorMessage] = useState<
    string | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<
    string | null
  >(null);

  const [moderation,setModeration]=useState<{id:string;action:ModerationAction}|null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const sequence = useRef(0);
  const loadAstrologers = useCallback(
    async (showRefreshState = false) => {
      const version = ++sequence.current;
      try {
        if (showRefreshState) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorMessage(null);

        const response = await adminFetch(
          `/admin/astrologers?${new URLSearchParams({page:String(page),limit:"20",search,approval:statusFilter === "PENDING" || statusFilter === "APPROVED" ? statusFilter : "ALL",onlineOnly:String(statusFilter === "ONLINE")})}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            cache: "no-store",
          },
        );

        const data =
          (await readJson(
            response,
          )) as AdminAstrologersResponse | null;

        if (version !== sequence.current) return;
        if (!response.ok) {
          const rawMessage = (data as { message?: unknown })?.message;

          const message = Array.isArray(rawMessage)
             ? rawMessage.join(", ")
             : typeof rawMessage === "string"
             ? rawMessage
             : undefined;
          throw new Error(
            message ||
              `Unable to load astrologers (${response.status}).`,
          );
        }

        setAstrologers(Array.isArray(data?.data) ? data.data : []);
        setTotalPages(Math.max(1,data?.pagination?.totalPages ?? 1));
      } catch (error) {
        if (version !== sequence.current) return;
        setAstrologers([]);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (version === sequence.current) {setIsLoading(false);setIsRefreshing(false); }
      }
    },
    [page,search,statusFilter],
  );

  useEffect(() => {
    const lifetime = sequence;
    const timer=setTimeout(()=>{void loadAstrologers();},250);
    return ()=>{clearTimeout(timer);lifetime.current++;};
  }, [loadAstrologers]);

  const filteredAstrologers = astrologers;

  const stats = useMemo(() => {
    return {
      total: astrologers.length,

      pending: astrologers.filter(
        (item) =>
          !item.isApproved && !item.isVerified,
      ).length,

      approved: astrologers.filter(
        (item) =>
          item.isApproved && item.isVerified,
      ).length,

      online: astrologers.filter(
        (item) => item.isOnline,
      ).length,
    };
  }, [astrologers]);

  async function updateAstrologer(astrologerId:string,action:'approve'|'reject'|'suspend') { setModeration({id:astrologerId,action:action.toUpperCase() as ModerationAction}); }

  return (
    <main className="asp-admin-page px-4 py-10 sm:px-6 lg:px-8">
      {moderation && <ModerationDialog kind="astrologers" {...moderation} onClose={()=>setModeration(null)} onDone={()=>{setModeration(null);setUpdatingId(null);setSuccessMessage('Audited moderation confirmed.');void loadAstrologers(true);}} />}
      <div className="asp-admin-shell">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="asp-admin-eyebrow">
              Admin Panel
            </p>

            <h1 className="asp-admin-title mt-2 text-3xl sm:text-4xl">
              Astrologer Management
            </h1>

            <p className="asp-admin-subtitle mt-3 max-w-3xl text-base">
              Review astrologer accounts, approval status,
              availability and consultation pricing.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/admin"
              className="asp-admin-back-btn"
            >
              Back to Dashboard
            </Link>

            <button
              type="button"
              onClick={() =>
                void loadAstrologers(true)
              }
              disabled={isRefreshing}
              className="asp-admin-primary-btn"
            >
              {isRefreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              Unable to load admin data
            </p>
            <p className="mt-1 text-sm text-red-600">
              {errorMessage}
            </p>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-700">
              {successMessage}
            </p>
          </div>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Total Astrologers
            </p>
            <p className="mt-3 text-3xl font-semibold text-[#0B1026]">
              {stats.total}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Pending Approval
            </p>
            <p className="mt-3 text-3xl font-semibold text-amber-700">
              {stats.pending}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Approved
            </p>
            <p className="mt-3 text-3xl font-semibold text-green-700">
              {stats.approved}
            </p>
          </article>

          <article className="asp-admin-stat-card">
            <p className="asp-admin-stat-label">
              Online
            </p>
            <p className="mt-3 text-3xl font-semibold text-blue-700">
              {stats.online}
            </p>
          </article>
        </section>

        <section className="asp-admin-panel mt-8 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                {setPage(1);setSearch(event.target.value);}
              }
              placeholder="Search by name, language, expertise or ID"
              className="asp-admin-input px-4 py-3"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                {setPage(1);setStatusFilter(event.target.value as StatusFilter);}
              }
              className="asp-admin-input px-4 py-3 font-semibold"
            >
              <option value="ALL">
                All statuses
              </option>
              <option value="PENDING">
                Pending
              </option>
              <option value="APPROVED">
                Approved
              </option>
              <option value="SUSPENDED" disabled>
                Suspension state not recorded
              </option>
              <option value="ONLINE">
                Online
              </option>
            </select>
          </div>

          <div className="my-4 flex gap-4 items-center" aria-label="Astrologer pages"><button disabled={isLoading || page <= 1} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page} of {totalPages}</span><button disabled={isLoading || page >= totalPages} onClick={()=>setPage(page+1)}>Next</button></div>
          {isLoading ? (
            <div className="py-16 text-center">
              <p className="font-semibold text-[#4B5C73]">
                Loading astrologers...
              </p>
            </div>
          ) : filteredAstrologers.length === 0 ? (
            <div className="py-16 text-center">
              <h2 className="text-2xl font-semibold text-[#0B1026]">
                No astrologers found
              </h2>

              <p className="mt-2 text-[#4B5C73]">
                No astrologer records match the selected filters.
              </p>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead className="asp-admin-table-head">
                  <tr className="text-left">
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Astrologer
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Expertise
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Price
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Status
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-[#243650]">
                      Availability
                    </th>
                    <th className="border-b border-gray-200 px-4 py-3 text-right text-xs font-semibold text-[#243650]">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAstrologers.map(
                    (astrologer) => (
                      <tr
                        key={astrologer.id}
                        className="align-top"
                      >
                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="font-bold text-[#0B1026]">
                            {getAstrologerName(
                              astrologer,
                            )}
                          </p>

                          <p className="mt-1 text-xs text-[#66758A]">
                            ID: {astrologer.id}
                          </p>

                          <p className="mt-1 text-sm text-[#4B5C73]">
                            {(astrologer.languages ?? [])
                              .join(", ") ||
                              "Languages not specified"}
                          </p>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5 text-sm text-[#263A55]">
                          {getExpertise(astrologer)}
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <p className="font-bold text-[#0B1026]">
                            ₹
                            {Number(
                              astrologer.pricePerMin ??
                                0,
                            ).toFixed(2)}
                            /min
                          </p>

                          <p className="mt-1 text-xs text-[#66758A]">
                            {astrologer.experience ?? 0}{" "}
                            years experience
                          </p>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClasses(
                              astrologer,
                            )}`}
                          >
                            {getStatusLabel(
                              astrologer,
                            )}
                          </span>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                              astrologer.isOnline
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-[#4B5C73]"
                            }`}
                          >
                            {astrologer.isOnline
                              ? "Online"
                              : "Offline"}
                          </span>
                        </td>

                        <td className="border-b border-gray-100 px-4 py-5">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/admin/astrologers/${encodeURIComponent(
                              astrologer.id,
                              )}`}
                                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-[#0B1026] transition hover:bg-gray-50"
                               >
                             View Profile
                             </Link>

                            {!astrologer.isApproved ||
                            !astrologer.isVerified ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAstrologer(
                                    astrologer.id,
                                    "approve",
                                  )
                                }
                                disabled={
                                  updatingId ===
                                  astrologer.id
                                }
                                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                              >
                                {updatingId ===
                                astrologer.id
                                  ? "Updating..."
                                  : "Approve"}
                              </button>
                            ) : null}

                            {!astrologer.isApproved ||
                            !astrologer.isVerified ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAstrologer(
                                    astrologer.id,
                                    "reject",
                                  )
                                }
                                disabled={
                                  updatingId ===
                                  astrologer.id
                                }
                                className="rounded-lg bg-[#10233D] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#10233D] disabled:opacity-50"
                              >
                                {updatingId ===
                                astrologer.id
                                  ? "Updating..."
                                  : "Reject"}
                              </button>
                            ) : null}

                            {astrologer.isApproved &&
                            astrologer.isVerified ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateAstrologer(
                                    astrologer.id,
                                    "suspend",
                                  )
                                }
                                disabled={
                                  updatingId ===
                                  astrologer.id
                                }
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                              >
                                {updatingId ===
                                astrologer.id
                                  ? "Updating..."
                                  : "Suspend"}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

