import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function BackToPractice() {
  return (
    <Link href="/practice" className="mb-2 -ml-1 inline-flex min-h-10 items-center gap-1.5 px-1 text-sm text-muted hover:text-text">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Practice toolkit
    </Link>
  );
}
