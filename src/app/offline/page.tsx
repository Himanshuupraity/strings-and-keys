import Link from "next/link";

export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="font-display text-4xl">You&apos;re offline</h1>
      <p className="mt-3 text-muted">Pages you&apos;ve opened before, the virtual instruments and your saved progress and the coach still work. Videos need an internet connection.</p>
      <Link href="/dashboard" className="mt-6 inline-block rounded-xl bg-accent px-5 py-2.5 font-medium text-accent-fg">Back to dashboard</Link>
    </main>
  );
}
