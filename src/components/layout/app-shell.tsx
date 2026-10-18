"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { BRAND } from "@/config/brand";
import { ALL_NAV, BRAND_ICON as Logo, NAV_SECTIONS } from "@/config/nav";
import { cn } from "@/components/ui";
import { InstrumentToggle } from "./instrument-toggle";
import { ThemeToggle } from "./theme-toggle";
import { AudioControls } from "./audio-controls";
import { LearnerMenu } from "@/components/learner/learner-menu";
import { WelcomeScreen } from "@/components/learner/welcome";
import { useLearner } from "@/hooks/use-learner";
import { useHydrated } from "@/hooks/use-prefs";
import { useT, type MessageKey } from "@/lib/i18n";
import { LanguageSwitch } from "./language-switch";

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href + "/")) || (href === "/learn" && pathname.startsWith("/lesson"));
}

const SECTION_KEY: Record<string, MessageKey> = { Learn: "nav.section.learn", Practice: "nav.section.practice", Explore: "nav.section.explore" };

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useT();
  return (
    <nav aria-label="Main" className="space-y-6">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{SECTION_KEY[section.title] ? t(SECTION_KEY[section.title]) : section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ href, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                      active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-text",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                    {t(`nav.${href}` as MessageKey)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-guitar to-piano text-white shadow-sm">
        <Logo className="h-5 w-5" aria-hidden />
      </span>
      <span className="font-display text-xl leading-none">{BRAND.name}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const mobileItems = ALL_NAV.filter((n) => n.mobile);
  const { learner } = useLearner();
  const hydrated = useHydrated();
  const t = useT();

  return (
    <div className="min-h-screen overflow-x-clip lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        {t("shell.skip")}
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface/80 backdrop-blur lg:flex">
        <div className="flex h-16 items-center px-5">
          <BrandMark />
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-6 pt-2">
          <NavLinks />
        </div>
        <div className="border-t border-border p-4 text-xs text-muted">{t("shell.savedUnderName")}</div>
      </aside>

      {/* Tablet/mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] overflow-y-auto bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <BrandMark />
              <button type="button" className="rounded-lg p-2 hover:bg-surface-2" aria-label={t("shell.closeMenu")} onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <LanguageSwitch className="mt-6" showLabel />
            <div className="mt-4 flex items-center justify-between rounded-xl border border-border p-2 sm:hidden">
              <AudioControls />
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6">
          <button type="button" className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-2 lg:hidden" aria-label={t("shell.openMenu")} onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:block lg:hidden">
            <BrandMark />
          </div>
          <div className="flex flex-1 justify-center sm:justify-end lg:justify-start">
            <InstrumentToggle size="sm" />
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <AudioControls />
          </div>
          <LearnerMenu />
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6 lg:pb-12">
        {!hydrated ? <div className="h-[60vh] animate-pulse rounded-2xl bg-surface-2/60" aria-busy="true" aria-label={t("shell.loading")} /> : learner ? children : <WelcomeScreen />}
      </main>

      {/* Mobile bottom navigation */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 pb-[env(safe-area-inset-bottom)]">
          {mobileItems.map(({ href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium", active ? "text-accent" : "text-muted")}>
                  <Icon className="h-5 w-5" aria-hidden />
                  {t(`nav.short.${href}` as MessageKey)}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setOpen(true)} className="flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium text-muted">
              <Menu className="h-5 w-5" aria-hidden />
              {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
