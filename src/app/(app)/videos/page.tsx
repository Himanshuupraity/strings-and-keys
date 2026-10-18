import type { Metadata } from "next";
import { VideoHub } from "@/components/videos/video-hub";

export const metadata: Metadata = { title: "Video Hub" };

export default function VideosPage() {
  return <VideoHub />;
}
