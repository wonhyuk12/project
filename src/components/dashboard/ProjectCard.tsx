import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="overflow-hidden transition-colors hover:bg-surface-hover">
        <div className={`h-24 w-full bg-gradient-to-br ${project.thumbnailColor}`} />
        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-medium leading-snug text-foreground">
              {project.title}
            </h3>
            <StatusBadge status={project.status} />
          </div>
          <p className="text-xs text-muted">{project.songName}</p>
          <div className="flex items-center gap-3 text-[11px] text-muted-2">
            <span>인원 {project.memberCount}명</span>
            <span>버전 {project.versionCount}개</span>
            <span>{project.updatedAt}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
