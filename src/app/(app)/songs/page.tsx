import type { Metadata } from "next";
import { SongsBrowser } from "@/components/songs/songs-browser";

export const metadata: Metadata = { title: "Song Lab" };

export default function SongsPage() {
  return <SongsBrowser />;
}
