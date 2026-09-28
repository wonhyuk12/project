"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="flex h-8 items-center justify-center whitespace-nowrap rounded-full px-2.5 text-xs text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      로그아웃
    </button>
  );
}
