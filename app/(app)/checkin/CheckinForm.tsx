"use client";

import { useState } from "react";
import type { Checkin, Commitment, CommitmentsHit } from "@/types";
import { formatLong, today } from "@/lib/date";

/**
 * F3 — the daily check-in. Target is under 60 seconds, which drives every choice
 * here: commitments are large tap targets, the note is optional and unlabelled by any
 * prompt that invites an essay, and there is exactly one button.
 *
 * Phase 1 keeps the result in local state. The write goes through `lib/data` in Phase
 * 2 — see the `onSave` handler, which is already shaped for an async call.
 */
export function CheckinForm({
  commitments,
  existing,
}: {
  commitments: Commitment[];
  existing: Checkin | null;
}) {
  const [hit, setHit] = useState<CommitmentsHit>(
    existing?.commitments_hit ?? {},
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [saved, setSaved] = useState(false);

  const hitCount = Object.values(hit).filter(Boolean).length;

  function toggle(commitmentId: string) {
    setHit((current) => ({ ...current, [commitmentId]: !current[commitmentId] }));
    setSaved(false);
  }

  function onSave() {
    // Phase 2: await saveCheckin({ date: today(), note, commitments_hit: hit })
    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">
          {existing ? "Update today's check-in" : "Check in"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">{formatLong(today())}</p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium uppercase tracking-wider text-neutral-500">
          What did you hit?
        </legend>

        <ul className="mt-3 space-y-2">
          {commitments.map((commitment) => {
            const checked = hit[commitment.id] === true;

            return (
              <li key={commitment.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                    checked
                      ? "border-emerald-700 bg-emerald-950/30"
                      : "border-neutral-800 bg-neutral-900 hover:border-neutral-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(commitment.id)}
                    className="h-5 w-5 shrink-0 accent-emerald-500"
                  />
                  <span className="flex-1 text-sm text-neutral-100">
                    {commitment.title}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                    {commitment.target_per_week}/wk
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div>
        <label
          htmlFor="note"
          className="text-sm font-medium uppercase tracking-wider text-neutral-500"
        >
          Note
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setSaved(false);
          }}
          rows={3}
          placeholder="One line is enough."
          className="mt-2 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Save check-in
        </button>

        <p className="text-sm text-neutral-500" aria-live="polite">
          {saved
            ? `Saved. ${hitCount} of ${commitments.length} hit.`
            : `${hitCount} of ${commitments.length} ticked.`}
        </p>
      </div>

      {saved && (
        <p className="text-xs text-neutral-600">
          Not stored yet — Phase 1 keeps this in local state only.
        </p>
      )}
    </div>
  );
}
