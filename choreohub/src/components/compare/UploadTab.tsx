"use client";

import { useState } from "react";
import { PoseExtractor, type ExtractionResult } from "@/components/upload/PoseExtractor";

interface Props {
  onExtracted: (result: ExtractionResult) => void;
}

export function UploadTab({ onExtracted }: Props) {
  const [consent, setConsent] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        본인이 권리를 가졌거나 사용 허락을 받은 영상입니다.
      </label>

      {consent ? (
        <PoseExtractor onExtracted={onExtracted} />
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-center text-xs text-muted-2">
          위 체크박스에 동의해야 영상을 올릴 수 있어요.
        </p>
      )}
    </div>
  );
}
