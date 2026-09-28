import Image from "next/image";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="ChoreoHub"
      width={size}
      height={size}
      className="rounded-xl"
      priority
    />
  );
}
