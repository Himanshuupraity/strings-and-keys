import Link from "next/link";
import { BRAND } from "@/config/brand";

export default function Landing() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <h1 className="font-display text-5xl">{BRAND.name}</h1>
      <p className="mt-4 text-muted">{BRAND.tagline}</p>
      <Link href="/dashboard" className="mt-8 inline-block rounded-xl bg-accent px-5 py-3 font-medium text-accent-fg">Start learning</Link>
    </main>
  );
}
