import type { Metadata } from "next";
import { Suspense } from "react";
import { HallOfFame } from "@/components/hall-of-fame";
import { getMyBests, getTopScores, type LeaderboardEntry } from "@/lib/scores";
import { getSessionUser } from "@/lib/supabase/session";

export const metadata: Metadata = {
  title: "Salón de la Fama · Arcade Vault",
};

async function HallOfFameWithMyBests({
  top,
  error,
}: {
  top: Record<string, LeaderboardEntry[]>;
  error: boolean;
}) {
  const user = await getSessionUser();
  const myBests = user ? await getMyBests(user.id) : {};
  return <HallOfFame top={top} myBests={myBests} error={error} />;
}

async function HallOfFameLoader() {
  let top: Record<string, LeaderboardEntry[]> = {};
  let error = false;

  try {
    top = await getTopScores(12);
  } catch (err) {
    console.error("[scores] Error cargando top scores en hall-of-fame:", err);
    error = true;
  }

  return (
    <Suspense fallback={<HallOfFame top={top} myBests={{}} error={error} />}>
      <HallOfFameWithMyBests top={top} error={error} />
    </Suspense>
  );
}

export default function HallOfFamePage() {
  return (
    <Suspense fallback={<HallOfFame top={{}} myBests={{}} />}>
      <HallOfFameLoader />
    </Suspense>
  );
}
