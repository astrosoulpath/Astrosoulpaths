"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/features/admin/auth/admin-session";
import AboutView from "@/features/about/AboutView";
import {
  aboutFields,
  readAbout,
  type AboutContent,
} from "@/features/about/about-contract";
export default function AboutEditor() {
  const [content, setContent] = useState<AboutContent | null>(null),
    [revision, setRevision] = useState(0),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState(false),
    [canPublish, setCanPublish] = useState(false),
    [publishBlocker, setPublishBlocker] = useState(
      "Publication readiness has not been verified.",
    ),
    [audit, setAudit] = useState<
      { revision: number; action: string; at: string }[]
    >([]);
  const mounted = useRef(false),
    locked = useRef(false);
  async function load() {
    try {
      const response = await adminFetch("/admin/content/about", {
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw Error();
      const result = await response.json(),
        next = readAbout(result.draft?.content);
      if (mounted.current) {
        setContent(next);
        setRevision(result.draft.revision);
        setAudit(result.audit);
        setCanPublish(result.readiness?.canPublish === true);
        setPublishBlocker(
          result.readiness?.canPublish === true
            ? ""
            : "Publication is unavailable until the operator verifies the active shared application configuration. You can still save and preview drafts.",
        );
        setStatus(
          result.published.data.revision
            ? "Published revision " + result.published.data.revision
            : "Shared Flutter content · no CMS publication yet",
        );
      }
    } catch {
      if (mounted.current)
        setStatus(
          "Unable to load About CMS. Verify your Admin session and retry.",
        );
    }
  }
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, []);
  async function save(publish: boolean) {
    if (locked.current || !content) return;
    if (publish && !canPublish) {
      setStatus(publishBlocker);
      return;
    }
    if (
      publish &&
      !window.confirm(
        "Publish this approved content to the website and shared Flutter introduction?",
      )
    )
      return;
    locked.current = true;
    setBusy(true);
    try {
      const approved = readAbout(content);
      const response = await adminFetch("/admin/content/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: revision,
          content: approved,
          publish,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw Error(
          response.status === 409
            ? "Draft changed. Reload before saving."
            : "Save was not confirmed. Reload before retrying.",
        );
      const result = await response.json();
      if (mounted.current) {
        setRevision(result.data.revision);
        await load();
        setStatus(
          publish
            ? "Published successfully."
            : "Draft saved. Public content is unchanged.",
        );
      }
    } catch (error) {
      if (mounted.current)
        setStatus(error instanceof Error ? error.message : "Save failed.");
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <main className="asp-admin-page p-6">
      <div className="flex flex-wrap justify-between gap-4">
        <h1 className="text-3xl font-semibold">
          Content Management · About Us
        </h1>
        <Link href="/admin" className="asp-admin-gold-btn px-5 py-3">
          Back to Dashboard
        </Link>
      </div>
      <p role="status" className="my-5">
        {status || "Loading approved About content..."}
      </p>
      <button
        disabled={busy}
        onClick={() => void load()}
        className="underline py-3"
      >
        Reload saved version
      </button>
      {content && (
        <>
          <p className="mb-4">
            Plain text only. Publish only verified company content. Blank
            optional sections are hidden. Introduction is shared with Flutter;
            other sections remain website-managed.
          </p>
          {publishBlocker && (
            <p id="about-publish-blocker" role="status" className="mb-4">
              {publishBlocker}
            </p>
          )}
          <fieldset disabled={busy} className="grid gap-5 max-w-3xl">
            {aboutFields.map((key) => (
              <label key={key} className="grid gap-2 capitalize">
                {key}
                <textarea
                  className="rounded-xl border border-slate-300 bg-white p-3 text-slate-900"
                  rows={key === "title" ? 2 : 5}
                  maxLength={key === "title" ? 120 : 8000}
                  value={content[key]}
                  onChange={(event) =>
                    setContent({ ...content, [key]: event.target.value })
                  }
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-4">
              <button
                className="asp-admin-gold-btn px-5 py-3"
                onClick={() => void save(false)}
              >
                Save Draft
              </button>
              <button
                className="asp-admin-gold-btn px-5 py-3"
                disabled={!canPublish}
                aria-describedby={
                  publishBlocker ? "about-publish-blocker" : undefined
                }
                onClick={() => void save(true)}
              >
                Publish approved content
              </button>
              <button
                className="border rounded-xl px-5 py-3"
                onClick={() => setPreview(!preview)}
              >
                {preview ? "Hide" : "Preview"} changes
              </button>
            </div>
          </fieldset>
          {preview && (
            <section className="mt-8" aria-label="Unpublished About preview">
              <AboutView content={content} />
            </section>
          )}
          <h2 className="text-xl mt-8">Publishing & modification history</h2>
          <ul>
            {audit.map((item) => (
              <li key={item.revision}>
                Revision {item.revision} · {item.action} ·{" "}
                {new Date(item.at).toLocaleString()}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
