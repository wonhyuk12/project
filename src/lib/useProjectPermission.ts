import { useEffect, useState } from "react";
import { createClient } from "./supabase/client";

/** 이 프로젝트에서 내 권한을 확인한다. 소유자는 항상 둘 다 true.
 *  canEdit: '직접 수정'일 때만 true (버전 추가, 비교 분석 등).
 *  canPropose: '수정 제안' 이상(즉 '보기만'이 아니면)이면 true (수정 제안 올리기).
 *  확인 전까진 낙관적으로 true로 두고(깜빡임 방지), 실제 쓰기는 RLS가 최종 방어선이다. */
export function useProjectPermission(projectId: string, ownerId: string | undefined) {
  const [canEdit, setCanEdit] = useState(true);
  const [canPropose, setCanPropose] = useState(true);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!ownerId) return;
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      if (user.id === ownerId) {
        if (!cancelled) {
          setCanEdit(true);
          setCanPropose(true);
          setChecked(true);
        }
        return;
      }
      const { data: membership } = await supabase
        .from("project_members")
        .select("permission")
        .eq("project_id", projectId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setCanEdit(membership?.permission === "직접 수정");
        setCanPropose(
          membership?.permission === "직접 수정" || membership?.permission === "수정 제안",
        );
        setChecked(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, ownerId]);

  return { canEdit, canPropose, checked };
}
