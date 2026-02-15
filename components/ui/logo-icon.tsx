import { cn } from "@/lib/utils";

interface LogoIconProps {
  className?: string;
}

export function LogoIcon({ className }: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 624.49 581.6"
      fill="none"
      className={cn("shrink-0", className)}
    >
      <polyline
        points="355.65 355.28 328.35 286.55 367.03 271.19"
        fill="none"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeWidth="18"
      />
      <path
        d="M327.22,381.56c-52.03,0-94.21-42.18-94.21-94.21s42.18-94.21,94.21-94.21"
        fill="none"
        stroke="currentColor"
        strokeMiterlimit="10"
        strokeWidth="18"
      />
    </svg>
  );
}
