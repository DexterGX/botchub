import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getMyGroupCodes,
  getOfficialCharactersForFilter,
  getScriptsForPicker,
} from "@/lib/queries";
import { GameLogForm } from "@/app/games/GameLogForm";
import type { LogType } from "@/lib/types";

export const metadata = {
  title: "Log a game — BOTChub",
};

const MODES: LogType[] = ["fast", "detailed"];

interface LogPageProps {
  params: Promise<{ mode: string }>;
}

export default async function GameLogPage({ params }: LogPageProps) {
  const { mode } = await params;
  if (!MODES.includes(mode as LogType)) notFound();
  const logType = mode as LogType;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [characters, scripts, groupCodeSuggestions] = await Promise.all([
    getOfficialCharactersForFilter(),
    getScriptsForPicker(),
    getMyGroupCodes(),
  ]);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold">
        {logType === "fast" ? "Fast Log" : "Detailed Log"}
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {logType === "fast"
          ? "The essentials, in about a minute."
          : "Everything from Fast Log, plus a bit more detail."}
      </p>

      <div className="mt-8">
        <GameLogForm
          mode={logType}
          characters={characters}
          scripts={scripts}
          groupCodeSuggestions={groupCodeSuggestions}
        />
      </div>
    </main>
  );
}
