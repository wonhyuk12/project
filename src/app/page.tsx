import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

const FEATURES = [
  {
    icon: "🕺",
    title: "포즈 자동 기록",
    desc: "영상만 올리면 관절 움직임과 대형을 자동으로 추출해서 저장해요",
  },
  {
    icon: "🧠",
    title: "AI 안무 코치",
    desc: "레퍼런스 영상과 비교해서 다른 부분을 짚어줘요",
  },
  {
    icon: "🧍‍♂️",
    title: "3D 포메이션 뷰",
    desc: "구간별 대형을 3D로 돌려보며 확인할 수 있어요",
  },
];

export default function OnboardingPage() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-between border-border px-6 py-10 sm:border-x md:my-10 md:min-h-0 md:max-w-2xl md:rounded-3xl md:border md:px-10 md:py-12 md:shadow-2xl md:shadow-black/40">
      <div>
        <div className="mb-10 flex items-center gap-2">
          <Logo size={36} />
          <span className="text-lg font-semibold tracking-tight">ChoreoHub</span>
        </div>

        <AuthErrorBanner />

        <h1 className="mb-3 text-3xl font-semibold leading-tight tracking-tight">
          안무를 기록하고,
          <br />
          <span className="text-accent-light">AI와 함께</span> 다듬으세요
        </h1>
        <p className="mb-10 text-sm leading-relaxed text-muted">
          영상 업로드 한 번으로 포즈·대형을 자동 기록하고, 레퍼런스와 비교해
          피드백까지 받아보세요.
        </p>

        <div className="flex flex-col gap-4 md:grid md:grid-cols-3 md:gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="text-xl">{f.icon}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{f.title}</p>
                <p className="text-xs text-muted">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-10">
        <Link href="/dashboard">
          <Button className="w-full">시작하기</Button>
        </Link>
        <p className="text-center text-[11px] text-muted-2">
          로그인하지 않았다면 로그인 화면으로 이동해요
        </p>
      </div>
    </div>
  );
}
