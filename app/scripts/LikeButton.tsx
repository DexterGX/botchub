"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleScriptLikeAction } from "@/lib/script-like-actions";
import { formatCount } from "@/lib/types";

interface LikeButtonProps {
  scriptId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
  /** "inline" — small icon + plain count, for the browse list's table rows
   * and mobile cards. "stack" — icon above a formatCount()-ed number, for
   * the script detail page header (matches its Views stat's layout). */
  variant?: "inline" | "stack";
}

/** Click-to-like button shared between /scripts (list) and /scripts/[id]
 * (detail header) — same optimistic-update behavior either place, just
 * two layouts. Applies the toggle immediately, then calls the
 * toggleScriptLikeAction server action and reconciles with its real
 * result; on failure (or when the visitor isn't logged in) it reverts and,
 * for a logged-out click, sends them to /login instead of calling the
 * server at all. */
export function LikeButton({
  scriptId,
  initialLiked,
  initialCount,
  isLoggedIn,
  variant = "inline",
}: LikeButtonProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    const prevLiked = liked;
    const prevCount = count;
    const nextLiked = !prevLiked;
    setLiked(nextLiked);
    setCount(prevCount + (nextLiked ? 1 : -1));

    startTransition(async () => {
      const result = await toggleScriptLikeAction(scriptId);
      if (!result.ok) {
        setLiked(prevLiked);
        setCount(prevCount);
        return;
      }
      setLiked(result.liked);
      setCount(result.count);
    });
  }

  const heartClasses = liked
    ? "text-red-500 dark:text-red-400"
    : "text-zinc-400 dark:text-zinc-600";
  const title = isLoggedIn ? (liked ? "Unlike" : "Like") : "Log in to like";

  if (variant === "stack") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        title={title}
        className="flex flex-col items-center transition-opacity disabled:opacity-60"
      >
        <HeartIcon filled={liked} className={`h-5 w-5 shrink-0 ${heartClasses}`} />
        <span className="mt-1 text-sm font-semibold tabular-nums text-zinc-600 dark:text-zinc-400">
          {formatCount(count)}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      title={title}
      className="inline-flex items-center gap-1 transition-opacity disabled:opacity-60"
    >
      <HeartIcon filled={liked} className={`h-3.5 w-3.5 shrink-0 ${heartClasses}`} />
      {count}
    </button>
  );
}

/** Same path data as the static HeartIcon it replaces — filled with solid
 * color instead of the outline stroke once liked, the usual "liked" heart
 * convention. */
function HeartIcon({
  filled,
  className,
}: {
  filled: boolean;
  className: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      className={className}
      aria-hidden="true"
    >
      <path
        d="M10 17s-6-4-6-8.5A3.5 3.5 0 0110 6a3.5 3.5 0 016 2.5C16 13 10 17 10 17z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
