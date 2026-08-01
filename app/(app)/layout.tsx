import { Nav } from "@/components/Nav";
import { GoalBanner } from "@/components/GoalBanner";
import { getActiveGoal } from "@/lib/data";

/**
 * The signed-in app shell: nav plus the persistent goal banner (F6).
 *
 * Fetching the goal here rather than per-page is what makes the banner genuinely
 * persistent — layouts do not re-render on navigation, so the goal stays on screen
 * and is fetched once.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const goal = await getActiveGoal();

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <GoalBanner goal={goal} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
