import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BUILT_IN_SONGS, CATALOGUE_SONGS, getCatalogueSong, getSong } from "@/content/songs";
import { SongWorkspace } from "@/components/songs/song-workspace";
import { CatalogueView } from "@/components/songs/catalogue-view";

export function generateStaticParams() {
  return [...BUILT_IN_SONGS, ...CATALOGUE_SONGS].map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/songs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = getSong(id) ?? getCatalogueSong(id);
  return { title: s ? `${s.title} · Song Lab` : "Song Lab" };
}

export default async function SongPage({ params }: PageProps<"/songs/[id]">) {
  const { id } = await params;
  const song = getSong(id);
  if (song) return <SongWorkspace song={song} />;
  const cat = getCatalogueSong(id);
  if (cat) return <CatalogueView song={cat} />;
  notFound();
}
