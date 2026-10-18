import type { Metadata } from "next";
import { RecordPage } from "@/components/recordings/record-page";

export const metadata: Metadata = { title: "Record yourself" };

export default function RecordRoute() {
  return <RecordPage />;
}
