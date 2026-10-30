"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supportRequest } from "./support-request";
import { PublicHelpEditor } from './PublicHelpEditor';
import {
  readSupportCatalogue,
  supportCataloguePayload,
  type CatalogueConfig as Config,
  type CatalogueSnapshot as Snapshot,
} from "./support-catalogue-contract";
export function SupportCataloguePanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fence = useRef(0),
    locked = useRef(false);
  const load = useCallback(async () => {
    const revision = ++fence.current;
    setMessage("");
    setBusy(true);
    try {
      const value = await supportRequest("/admin/support/assistant/config");
      if (fence.current === revision) setSnapshot(readSupportCatalogue(value));
    } catch {
      if (fence.current === revision)
        setMessage(
          "Support configuration could not load. Retry; existing tickets remain available.",
        );
    } finally {
      if (fence.current === revision) setBusy(false);
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      fence.current++;
    };
  }, [load]);
  function edit(change: (config: Config) => void) {
    if (!snapshot?.editable || busy) return;
    const config = structuredClone(snapshot.config);
    change(config);
    setSnapshot({ ...snapshot, config });
    setMessage("Unsaved changes");
  }
  function move<T>(items: T[], index: number, direction: number) {
    const target = index + direction;
    if (target >= 0 && target < items.length)
      [items[index], items[target]] = [items[target], items[index]];
  }
  async function save(action: 'DRAFT' | 'PUBLISH') {
    if (locked.current || !snapshot?.editable) return;
    locked.current = true;
    setBusy(true);
    const revision = fence.current;
    try {
      const value = await supportRequest("/admin/support/assistant/config", {
        method: "PUT",
        body: JSON.stringify(
          {...supportCataloguePayload(snapshot.revision, snapshot.config), action},
        ),
      });
      if (fence.current === revision) {
        setSnapshot(readSupportCatalogue(value));
        setMessage(`${action === 'DRAFT' ? 'Saved unpublished draft' : 'Published approved configuration'} revision ${value.revision}`);
      }
    } catch {
      if (fence.current === revision)
        setMessage(
          "Save was not confirmed. A permission, validation or revision conflict may require Reload. Do not assume it was saved.",
        );
    } finally {
      locked.current = false;
      if (fence.current === revision) setBusy(false);
    }
  }
  return (
    <section
      className="mt-6 rounded-2xl border border-[#E4D3AF] bg-white p-5"
      aria-label="AI Support configuration"
    >
      <h2 className="text-xl font-semibold">
        AI Support welcome, topics &amp; knowledge
      </h2>
      <p className="mt-2 text-sm">
        Changes are versioned in the existing immutable support audit stream. No
        payment or account action can be enabled here.
      </p>
      {message && (
        <p role="status" className="my-3">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
        className="asp-admin-outline-btn mt-3 px-3 py-2"
      >
        Reload configuration
      </button>
      {snapshot && (
        <>
          <p className="my-3 text-sm">
            Revision {snapshot.revision} ·{" "}
            {snapshot.editable
              ? "Admin editing available"
              : "Read only: support operations schema and release approval required"}
          </p>
          {!!snapshot.history?.length && (
            <details className="my-3">
              <summary>Configuration audit history</summary>
              {snapshot.history.map((row) => (
                <p key={row.id} className="text-sm">
                  Revision {row.revision} ·{" "}
                  {new Date(row.createdAt).toLocaleString()}
                </p>
              ))}
            </details>
          )}
          <fieldset disabled={busy || !snapshot.editable} className="space-y-4">
            <PublicHelpEditor value={snapshot.config.publicHelp} onChange={value => edit(config => {config.publicHelp = value;})}/>
            <label className="block">
              Welcome text
              <textarea
                aria-label="Support welcome text"
                maxLength={500}
                value={snapshot.config.welcome}
                onChange={(e) =>
                  edit((c) => {
                    c.welcome = e.target.value;
                  })
                }
                className="asp-admin-input mt-1 w-full"
              />
            </label>
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={snapshot.config.visible}
                onChange={(e) =>
                  edit((c) => {
                    c.visible = e.target.checked;
                  })
                }
              />
              Show AI Support bot
            </label>
            {snapshot.config.categories.map((category, i) => (
              <div
                key={category.id}
                className="rounded-xl border border-[#E4D3AF] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`${category.id} category title`}
                    maxLength={80}
                    value={category.title}
                    onChange={(e) =>
                      edit((c) => {
                        c.categories[i].title = e.target.value;
                      })
                    }
                    className="asp-admin-input min-w-0 flex-1"
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={category.enabled}
                      onChange={(e) =>
                        edit((c) => {
                          c.categories[i].enabled = e.target.checked;
                        })
                      }
                    />{" "}
                    Enabled
                  </label>
                  <button
                    type="button"
                    aria-label={`Move ${category.title} up`}
                    disabled={i === 0}
                    onClick={() => edit((c) => move(c.categories, i, -1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${category.title} down`}
                    disabled={i === 2}
                    onClick={() => edit((c) => move(c.categories, i, 1))}
                  >
                    ↓
                  </button>
                </div>
                {category.questions.map((q, j) => (
                  <div
                    key={q.id}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input
                      aria-label={`Question ${q.id}`}
                      maxLength={300}
                      value={q.text}
                      onChange={(e) =>
                        edit((c) => {
                          c.categories[i].questions[j].text = e.target.value;
                        })
                      }
                      className="asp-admin-input min-w-0 flex-1"
                    />
                    <label>
                      <input
                        type="checkbox"
                        checked={q.enabled}
                        onChange={(e) =>
                          edit((c) => {
                            c.categories[i].questions[j].enabled =
                              e.target.checked;
                          })
                        }
                      />{" "}
                      Active
                    </label>
                    <button
                      type="button"
                      aria-label={`Move question ${j + 1} up`}
                      disabled={j === 0}
                      onClick={() =>
                        edit((c) => move(c.categories[i].questions, j, -1))
                      }
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move question ${j + 1} down`}
                      disabled={j === category.questions.length - 1}
                      onClick={() =>
                        edit((c) => move(c.categories[i].questions, j, 1))
                      }
                    >
                      ↓
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="mt-3 underline"
                  disabled={category.questions.length >= 30}
                  onClick={() =>
                    edit((c) => {
                      c.categories[i].questions.push({
                        id: `${category.id}-${crypto.randomUUID()}`,
                        text: "New support question",
                        enabled: false,
                      });
                    })
                  }
                >
                  Add disabled question
                </button>
              </div>
            ))}
            <label className="block">
              Approved FAQ reference (one item per line; no secrets or customer
              records)
              <textarea
                aria-label="Approved support knowledge"
                value={snapshot.config.knowledge.join("\n")}
                onChange={(e) =>
                  edit((c) => {
                    c.knowledge = e.target.value.split("\n");
                  })
                }
                className="asp-admin-input mt-1 min-h-28 w-full"
              />
            </label>
            <button
              type="button"
              onClick={() => void save('DRAFT')}
              className="asp-admin-gold-btn px-4 py-2"
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button type="button" disabled={busy} onClick={() => void save('PUBLISH')} className="asp-admin-gold-btn ml-3 px-4 py-2">Publish approved changes</button>
            <p className="mt-3 text-sm" role="status">{snapshot.isDraft ? 'Unpublished draft' : 'Published configuration'} · Published revision {snapshot.publishedRevision ?? snapshot.revision}. Drafts are not served to the website or app.</p>
          </fieldset>
        </>
      )}
    </section>
  );
}
