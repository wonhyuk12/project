import type { ProjectStatus } from "@/lib/types";

const LABEL: Record<ProjectStatus, string> = {
  in_progress: "진행중",
  completed: "완료",
};

const CLASSES: Record<ProjectStatus, string> = {
  in_progress: "bg-accent/15 text-accent-light border-accent/40",
  completed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30",
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${CLASSES[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
