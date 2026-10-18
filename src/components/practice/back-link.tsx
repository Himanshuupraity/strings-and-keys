import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToPractice() {
  return (
    <Link href="/practice" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Practice toolkit
    </Link>
  );
}
