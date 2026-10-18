import {
  BarChart3, BookOpen, Bot, Gauge, Guitar, LayoutDashboard, ListMusic, Music4, Piano, Settings, Timer, Video,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar */
  mobile?: boolean;
}

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Learn",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, mobile: true },
      { href: "/learn", label: "Curriculum", icon: BookOpen, mobile: true },
      { href: "/ai-coach", label: "AI Coach", icon: Bot, mobile: true },
    ],
  },
  {
    title: "Practice",
    items: [
      { href: "/practice", label: "Practice toolkit", icon: Timer, mobile: true },
      { href: "/piano-lab", label: "Piano Lab", icon: Piano },
      { href: "/guitar-lab", label: "Guitar Lab", icon: Guitar },
      { href: "/tuner", label: "Tuner", icon: Gauge },
    ],
  },
  {
    title: "Explore",
    items: [
      { href: "/songs", label: "Song Lab", icon: ListMusic },
      { href: "/videos", label: "Video Hub", icon: Video },
      { href: "/progress", label: "Progress", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV = NAV_SECTIONS.flatMap((s) => s.items);
export const BRAND_ICON = Music4;
