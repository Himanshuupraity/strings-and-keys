import Link from "next/link";
import { T } from "@/components/ui/t";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="font-display text-4xl"><T k="offline.title" /></h1>
      <p className="mt-3 text-muted"><T k="offline.body" /></p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-accent px-5 py-2.5 font-medium text-accent-fg"><T k="offline.back" /></Link>
    </main>
  );
}
