"use client";
import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import {
  AdminAstrologer,
  getAdminAstrologers,
} from "@/services/adminService";
import { ModerationDialog, type ModerationAction } from '../moderation/ModerationDialog';
import { ActionButtons } from "./ActionButtons";
import { StatusBadge } from "./StatusBadge";

function getStatus(astrologer: AdminAstrologer) {
  if (astrologer.isApproved && astrologer.isVerified) return "APPROVED";
  return "REVIEW_REQUIRED";
}

export function AstrologerTable() {
  const [astrologers, setAstrologers] = useState<AdminAstrologer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [moderation,setModeration]=useState<{id:string;action:ModerationAction}|null>(null);
  const sequence=useRef(0);
  async function loadAstrologers() {
    const version=++sequence.current;
    try {
      setLoading(true);
      setError("");

      const response = await getAdminAstrologers();
      if(version===sequence.current)setAstrologers(response?.data || []);
    } catch (err: any) {
      if(version===sequence.current)setError(err?.message || "Failed to load astrologers.");
    } finally {
      if(version===sequence.current)setLoading(false);
    }
  }

  function handleApprove(id:string){setModeration({id,action:'APPROVE'});}
  function handleReject(id:string){setModeration({id,action:'REJECT'});}
  function handleSuspend(id:string){setModeration({id,action:'SUSPEND'});}

  useEffect(() => {
    const lifetime=sequence;
    void loadAstrologers();
    return()=>{lifetime.current++;};
  }, []);

  return (
    <div className="rounded-2xl border border-[#E5EAF1] bg-white p-5 shadow-sm sm:p-6">
      {moderation&&<ModerationDialog kind="astrologers" id={moderation.id} action={moderation.action} onClose={()=>setModeration(null)} onDone={()=>{setModeration(null);void loadAstrologers();}}/>}
      <h2 className="text-xl font-semibold tracking-tight text-[#14243D] sm:text-2xl">
        Astrologer Approval Management
      </h2>

      {loading && (
        <p className="mt-6 rounded-xl border border-[#E5EAF1] bg-white px-4 py-5 text-sm font-medium text-[#52627A]">
          Loading astrologers...
        </p>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      {!loading && !error && astrologers.length === 0 && (
        <p className="mt-6 rounded-xl border border-[#E5EAF1] bg-white px-4 py-5 text-sm font-medium text-[#52627A]">
          No astrologers found.
        </p>
      )}

      {!loading && !error && astrologers.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E5EAF1] bg-white">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm text-[#14243D]">
            <thead>
              <tr className="border-b border-[#E5EAF1] bg-white">
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6818]">
                  Astrologer
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6818]">
                  Experience
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6818]">
                  Languages
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6818]">
                  Specialties
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6818]">
                  Price/min
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6818]">
                  Status
                </th>
                <th className="px-4 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#8A6818]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {astrologers.map((astrologer) => (
                <tr
                  key={astrologer.id}
                  className="border-b border-[#E5EAF1] transition duration-200 hover:bg-amber-400/[0.045]"
                >
                  <td className="max-w-[210px] px-4 py-4 font-mono text-xs font-semibold text-[#52627A]">
                    <span className="block font-sans text-[15px] font-semibold text-[#14243D]">{(astrologer as typeof astrologer & {user?:{name?:string|null;userProfile?:{fullName?:string|null}}}).user?.userProfile?.fullName || (astrologer as typeof astrologer & {user?:{name?:string|null}}).user?.name || "Name unavailable"}</span>
                    {astrologer.id}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-[#14243D]">
                    {astrologer.experience == null ? "Unavailable" : `${astrologer.experience} years`}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-[#14243D]">
                    {astrologer.languages?.join(", ") || "-"}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-[#14243D]">
                    {astrologer.expertise
                      ?.map((item) => item.expertise?.name)
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-[#14243D]">
                    {astrologer.pricePerMin == null ? "Unavailable" : `\u20B9${astrologer.pricePerMin}`}
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-[#14243D]">
                    <StatusBadge status={getStatus(astrologer)} />
                  </td>

                  <td className="px-4 py-4 text-sm font-medium text-[#14243D]">
                    <div className="flex min-w-max flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/astrologers/${encodeURIComponent(
                          astrologer.id,
                        )}`}
                        className="rounded-lg border border-[#E5EAF1] bg-[#10233D] px-3 py-2 text-xs font-bold text-white transition hover:border-amber-400/60 hover:bg-amber-400/10 hover:text-white"
                      >
                        View Profile
                      </Link>

                      <ActionButtons
                        onApprove={() => handleApprove(astrologer.id)}
                        onReject={() => handleReject(astrologer.id)}
                        onSuspend={() => handleSuspend(astrologer.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
