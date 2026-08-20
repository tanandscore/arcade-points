import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabaseServer";
import Navbar from "@/components/Navbar";
import Leaderboard from "@/components/Leaderboard";
import MathClient from "./MathClient";
import BuyButton from "./BuyButton";

export default async function MathPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("username").eq("id", user.id).single();
  const { data: scores } = await supabase.from("scores").select("game, score").eq("user_id", user.id);
  const totalPoints = (scores || []).reduce((sum, r) => sum + r.score, 0);
  const username = profile?.username || user.email;

  const { data: purchase } = await supabase
    .from("purchases")
    .select("game")
    .eq("user_id", user.id)
    .eq("game", "math")
    .maybeSingle();

  const owned = !!purchase;

  return (
    <div>
      <Navbar username={username} points={totalPoints} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-pixel text-xs text-accentAmber mb-8 text-center">MATH RUSH</h1>

        {owned ? (
          <MathClient />
        ) : (
          <div className="rounded-xl border border-lineColor p-8 text-center bg-bgPanel">
            <div className="text-3xl mb-3">🔢</div>
            <p className="text-textDim mb-1">Math Rush is a paid game.</p>
            <p className="font-pixel text-xl text-accentAmber mb-6">₹149</p>
            <BuyButton />
          </div>
        )}

        <div className="mt-12">
          <h2 className="font-pixel text-[10px] mb-3 text-textDim">TOP 10</h2>
          <div className="rounded-xl border border-lineColor p-4 bg-bgPanel">
            <Leaderboard game="math" highlightUsername={username} />
          </div>
        </div>
      </div>
    </div>
  );
}
