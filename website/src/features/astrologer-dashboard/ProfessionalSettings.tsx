"use client";
import { useState } from "react";
import {
  availabilityPayload,
  profilePayload,
  record,
  type Row,
  type AvailabilityDay,
} from "./dashboard-api";
import s from "./professional.module.css";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function ProfessionalSettings({
  profile,
  availability,
  blocked,
  onDirty,
  onSave,
}: {
  profile: Row | null;
  availability: Row | null;
  blocked: boolean;
  onDirty: (v: boolean) => void;
  onSave: (kind: "profile" | "availability", body: object) => Promise<void>;
}) {
  const [bio, setBio] = useState(String(profile?.bio ?? "")),
    [price, setPrice] = useState(
      profile?.pricePerMin == null ? "" : String(profile.pricePerMin),
    ),
    [timezone, setTimezone] = useState(String(availability?.timezone ?? "")),
    [days, setDays] = useState<AvailabilityDay[]>(
      Array.isArray(availability?.days)
        ? availability.days.map((v) => {
            const d = record(v);
            return {
              dayOfWeek: Number(d.dayOfWeek),
              isEnabled: d.isEnabled === true,
              startTime: String(d.startTime ?? ""),
              endTime: String(d.endTime ?? ""),
            };
          })
        : [],
    ),
    [error, setError] = useState("");
  function changeDay(index: number, patch: Partial<AvailabilityDay>) {
    setDays((current) =>
      current.map((day, i) => (i === index ? { ...day, ...patch } : day)),
    );
    onDirty(true);
  }
  async function save(kind: "profile" | "availability") {
    setError("");
    try {
      const body =
        kind === "profile"
          ? profilePayload(bio, price)
          : availabilityPayload(timezone, days);
      await onSave(kind, body);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Change not confirmed. Reload before retrying.",
      );
    }
  }
  return (
    <div className={s.fields}>
      {error && <p role="alert">{error}</p>}
      <details id="profile-settings">
        <summary>Edit professional description & future rate</summary>
        {!profile ? (
          <p>Load the professional profile before editing.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save("profile");
            }}
          >
            <fieldset disabled={blocked} className={s.fields}>
              <label>
                Professional description
                <textarea
                  value={bio}
                  maxLength={4000}
                  onChange={(e) => {
                    setBio(e.target.value);
                    onDirty(true);
                  }}
                />
              </label>
              <label>
                Rate per minute (original INR currency)
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    onDirty(true);
                  }}
                />
              </label>
              <p className={s.note}>
                Applies to future consultations under existing server rules.
                Existing sessions, earnings and identity/KYC records are not
                edited.
              </p>
              <button>Save professional settings</button>
            </fieldset>
          </form>
        )}
      </details>
      <details id="schedule-settings">
        <summary>Edit weekly availability</summary>
        {!availability ? (
          <p>Availability could not be loaded. Reload before editing.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save("availability");
            }}
          >
            <fieldset disabled={blocked} className={s.fields}>
              <label>
                IANA timezone
                <input
                  value={timezone}
                  placeholder="Asia/Kolkata"
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    onDirty(true);
                  }}
                />
              </label>
              {days.map((day, i) => (
                <div className={s.day} key={day.dayOfWeek}>
                  <label>
                    <input
                      type="checkbox"
                      checked={day.isEnabled}
                      onChange={(e) =>
                        changeDay(i, { isEnabled: e.target.checked })
                      }
                    />
                    {weekdays[day.dayOfWeek]}
                  </label>
                  <label>
                    Start
                    <input
                      aria-label={weekdays[day.dayOfWeek] + " start"}
                      type="time"
                      value={day.startTime}
                      onChange={(e) =>
                        changeDay(i, { startTime: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    End
                    <input
                      aria-label={weekdays[day.dayOfWeek] + " end"}
                      type="time"
                      value={day.endTime}
                      onChange={(e) =>
                        changeDay(i, { endTime: e.target.value })
                      }
                    />
                  </label>
                  {Array.isArray(availability.days) &&
                  availability.days.some(
                    (v) => Number(record(v).dayOfWeek) === day.dayOfWeek,
                  ) ? (
                    <button
                      type="button"
                      disabled={!day.isEnabled}
                      onClick={() => changeDay(i, { isEnabled: false })}
                    >
                      Disable day
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setDays((current) => current.filter((_, n) => n !== i));
                        onDirty(true);
                      }}
                    >
                      Discard unsaved day
                    </button>
                  )}
                </div>
              ))}
              <label>
                Add weekday
                <select
                  value=""
                  disabled={days.length === 7}
                  onChange={(e) => {
                    setDays((current) => [
                      ...current,
                      {
                        dayOfWeek: Number(e.target.value),
                        isEnabled: false,
                        startTime: "",
                        endTime: "",
                      },
                    ]);
                    onDirty(true);
                  }}
                >
                  <option value="">Choose a day</option>
                  {weekdays.map(
                    (day, i) =>
                      !days.some((d) => d.dayOfWeek === i) && (
                        <option key={day} value={i}>
                          {day}
                        </option>
                      ),
                  )}
                </select>
              </label>
              <p className={s.note}>
                Weekly availability is not a booking calendar. Enter your actual
                hours; overnight ranges require separate days.
              </p>
              <button disabled={!days.length}>Save weekly availability</button>
            </fieldset>
          </form>
        )}
      </details>
    </div>
  );
}
