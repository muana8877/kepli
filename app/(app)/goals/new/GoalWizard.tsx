"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  CommitmentDraft,
  GoalDraft,
  MilestoneDraft,
  NewGoalInput,
} from "@/types";
import { addDays, toDateString } from "@/lib/date";
import { createGoalAction } from "@/app/actions";

/**
 * F1 — goal creation, in three steps: the goal, then monthly milestones, then weekly
 * commitments.
 *
 * Split into steps on purpose. Asking for all three at once produces a wall of empty
 * inputs, and the whole product exists for people who stall at exactly that moment.
 * Each step is independently valid, so the user can always move forward.
 *
 * Submitting goes through the `createGoalAction` Server Action, which writes all
 * three tables in one transaction.
 */

type Step = 1 | 2 | 3 | 4;

export function GoalWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>(1);

  const [goal, setGoal] = useState<GoalDraft>({
    title: "",
    why: "",
    deadline: toDateString(addDays(new Date(), 90)),
  });
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: "", target_date: toDateString(addDays(new Date(), 30)) },
  ]);
  const [commitments, setCommitments] = useState<CommitmentDraft[]>([
    { title: "", target_per_week: 3 },
  ]);

  const goalValid =
    goal.title.trim().length > 0 &&
    goal.why.trim().length > 0 &&
    goal.deadline.length > 0;

  const filledMilestones = milestones.filter((m) => m.title.trim().length > 0);
  const filledCommitments = commitments.filter(
    (c) => c.title.trim().length > 0 && c.target_per_week > 0,
  );

  function onSubmit() {
    const input: NewGoalInput = {
      goal: {
        title: goal.title.trim(),
        why: goal.why.trim(),
        deadline: goal.deadline,
      },
      milestones: filledMilestones.map((m) => ({
        title: m.title.trim(),
        target_date: m.target_date,
      })),
      commitments: filledCommitments.map((c) => ({
        title: c.title.trim(),
        target_per_week: c.target_per_week,
      })),
    };

    setError(null);

    startTransition(async () => {
      const result = await createGoalAction(input);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setStep(4);
      // The goal banner lives in the layout, so pull the newly created goal.
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">
          {step === 4 ? "Goal set" : "Set your goal"}
        </h1>
        {step < 4 && <StepIndicator current={step} />}
      </div>

      {step === 1 && (
        <StepGoal
          value={goal}
          onChange={setGoal}
          valid={goalValid}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepMilestones
          value={milestones}
          onChange={setMilestones}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepCommitments
          value={commitments}
          onChange={setCommitments}
          valid={filledCommitments.length > 0}
          pending={pending}
          error={error}
          onBack={() => setStep(2)}
          onSubmit={onSubmit}
        />
      )}

      {step === 4 && (
        <Summary
          goal={goal}
          milestones={filledMilestones}
          commitments={filledCommitments}
        />
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const labels = ["Goal", "Milestones", "Commitments"];

  return (
    <ol className="mt-3 flex items-center gap-2">
      {labels.map((label, index) => {
        const number = index + 1;
        const isCurrent = number === current;
        const isDone = number < current;

        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`text-xs ${
                isCurrent
                  ? "font-medium text-white"
                  : isDone
                    ? "text-neutral-400"
                    : "text-neutral-600"
              }`}
            >
              {number}. {label}
            </span>
            {number < labels.length && (
              <span className="text-neutral-700" aria-hidden="true">
                /
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------------------------------------------------------- Step 1 -- */

function StepGoal({
  value,
  onChange,
  valid,
  onNext,
}: {
  value: GoalDraft;
  onChange: (next: GoalDraft) => void;
  valid: boolean;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <Field label="What is the goal?" htmlFor="title">
        <input
          id="title"
          type="text"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          placeholder="Ship Kepli to public beta"
          className={inputClass}
        />
      </Field>

      <Field
        label="Why does it matter?"
        htmlFor="why"
        hint="This is repeated on every screen. Write the version that stings."
      >
        <textarea
          id="why"
          value={value.why}
          onChange={(e) => onChange({ ...value, why: e.target.value })}
          rows={3}
          placeholder="Because I have missed every self-set deadline this year."
          className={`${inputClass} resize-none`}
        />
      </Field>

      <Field label="Deadline" htmlFor="deadline">
        <input
          id="deadline"
          type="date"
          value={value.deadline}
          onChange={(e) => onChange({ ...value, deadline: e.target.value })}
          className={`${inputClass} scheme-dark`}
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          disabled={!valid}
          className={primaryButtonClass}
        >
          Next: milestones
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Step 2 -- */

function StepMilestones({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: MilestoneDraft[];
  onChange: (next: MilestoneDraft[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function update(index: number, patch: Partial<MilestoneDraft>) {
    onChange(value.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  }

  function add() {
    const last = value[value.length - 1];
    const nextDate = last
      ? toDateString(addDays(new Date(last.target_date), 30))
      : toDateString(addDays(new Date(), 30));
    onChange([...value, { title: "", target_date: nextDate }]);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-400">
        Break the goal into monthly checkpoints. Skip any you are unsure of — you can
        add them later.
      </p>

      <ul className="space-y-3">
        {value.map((milestone, index) => (
          <li
            key={index}
            className="space-y-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <input
              type="text"
              value={milestone.title}
              onChange={(e) => update(index, { title: e.target.value })}
              placeholder="Waitlist page live"
              aria-label={`Milestone ${index + 1} title`}
              className={inputClass}
            />
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={milestone.target_date}
                onChange={(e) => update(index, { target_date: e.target.value })}
                aria-label={`Milestone ${index + 1} target date`}
                className={`${inputClass} scheme-dark`}
              />
              {value.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="shrink-0 text-sm text-neutral-500 hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className="text-sm text-neutral-400 hover:text-white"
      >
        + Add milestone
      </button>

      <div className="flex justify-between">
        <button type="button" onClick={onBack} className={secondaryButtonClass}>
          Back
        </button>
        <button type="button" onClick={onNext} className={primaryButtonClass}>
          Next: commitments
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Step 3 -- */

function StepCommitments({
  value,
  onChange,
  valid,
  pending,
  error,
  onBack,
  onSubmit,
}: {
  value: CommitmentDraft[];
  onChange: (next: CommitmentDraft[]) => void;
  valid: boolean;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  function update(index: number, patch: Partial<CommitmentDraft>) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-400">
        What do you do every week to get there? These are what today&apos;s action is
        derived from, so keep them concrete and repeatable.
      </p>

      <ul className="space-y-3">
        {value.map((commitment, index) => (
          <li
            key={index}
            className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4"
          >
            <input
              type="text"
              value={commitment.title}
              onChange={(e) => update(index, { title: e.target.value })}
              placeholder="Build session"
              aria-label={`Commitment ${index + 1} title`}
              className={`${inputClass} flex-1`}
            />
            <div className="flex shrink-0 items-center gap-2">
              <input
                type="number"
                min={1}
                max={7}
                value={commitment.target_per_week}
                onChange={(e) =>
                  update(index, {
                    target_per_week: Math.max(
                      1,
                      Math.min(7, Number(e.target.value) || 1),
                    ),
                  })
                }
                aria-label={`Commitment ${index + 1} times per week`}
                className={`${inputClass} w-16 text-center tabular-nums`}
              />
              <span className="text-sm text-neutral-500">/wk</span>
              {value.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  className="text-sm text-neutral-500 hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...value, { title: "", target_per_week: 3 }])}
        className="text-sm text-neutral-400 hover:text-white"
      >
        + Add commitment
      </button>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className={secondaryButtonClass}
        >
          Back
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!valid || pending}
          className={primaryButtonClass}
        >
          {pending ? "Saving…" : "Set the goal"}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Summary -- */

function Summary({
  goal,
  milestones,
  commitments,
}: {
  goal: GoalDraft;
  milestones: MilestoneDraft[];
  commitments: CommitmentDraft[];
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-base font-semibold text-white">{goal.title}</h2>
        <p className="mt-2 text-sm text-neutral-400">{goal.why}</p>
        <p className="mt-2 text-xs text-neutral-600">Deadline {goal.deadline}</p>

        {milestones.length > 0 && (
          <>
            <h3 className="mt-6 text-xs font-medium uppercase tracking-wider text-neutral-500">
              Milestones
            </h3>
            <ul className="mt-2 space-y-1">
              {milestones.map((m, i) => (
                <li key={i} className="text-sm text-neutral-300">
                  {m.title}{" "}
                  <span className="text-neutral-600">— {m.target_date}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h3 className="mt-6 text-xs font-medium uppercase tracking-wider text-neutral-500">
          Weekly commitments
        </h3>
        <ul className="mt-2 space-y-1">
          {commitments.map((c, i) => (
            <li key={i} className="text-sm text-neutral-300">
              {c.title}{" "}
              <span className="tabular-nums text-neutral-600">
                — {c.target_per_week}/wk
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/" className={primaryButtonClass}>
        Go to Today
      </Link>
    </div>
  );
}

/* ----------------------------------------------------------------- Bits --- */

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium uppercase tracking-wider text-neutral-500"
      >
        {label}
      </label>
      {hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none";

const primaryButtonClass =
  "inline-block rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400";

const secondaryButtonClass =
  "rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800";
