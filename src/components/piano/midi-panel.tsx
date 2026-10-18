"use client";
import { useT } from "@/lib/i18n";

import { Cable, PlugZap, Unplug } from "lucide-react";
import { Badge, Button, Callout, Card, CardBody, CardHeader } from "@/components/ui";
import { midiToName } from "@/lib/music/notes";

export function MidiPanel({
  supported,
  status,
  devices,
  error,
  held,
  onConnect,
  onDisconnect,
}: {
  supported: boolean;
  status: "idle" | "connecting" | "connected" | "error";
  devices: string[];
  error: string | null;
  held: Set<number>;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const tr = useT();
  return (
    <Card>
      <CardHeader
        icon={<Cable className="h-5 w-5" />}
        title={tr("ui.midi_keyboard")}
        description={tr("ui.optional_gives_exact_notes_and_timing_more_relia")}
        action={status === "connected" ? <Badge tone="success">{tr("ui.connected")}</Badge> : undefined}
      />
      <CardBody className="space-y-3">
        {!supported ? (
          <Callout tone="warn" title={tr("ui.web_midi_isn_t_available_in_this_browser")}>
            {tr("ui.use_chrome_edge_or_opera_on_a_desktop_computer_f")}
          </Callout>
        ) : status === "connected" ? (
          <>
            {devices.length ? (
              <ul className="space-y-1 text-sm">
                {devices.map((d) => (
                  <li key={d} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-success" aria-hidden /> {d}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{tr("ui.access_granted_but_no_keyboard_is_plugged_in_con")}</p>
            )}
            <p className="text-sm" aria-live="polite">
              <span className="text-muted">{tr("ui.incoming_notes")} </span>
              <span className="font-medium">{held.size ? [...held].sort((a, b) => a - b).map((m) => midiToName(m)).join(", ") : "—"}</span>
            </p>
            <Button size="sm" variant="ghost" onClick={onDisconnect}>
              <Unplug className="h-4 w-4" /> {tr("ui.disconnect")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">{tr("ui.plug_your_keyboard_in_by_usb_or_a_usb_midi_adapt")}</p>
            <Button size="sm" onClick={onConnect} loading={status === "connecting"} data-testid="midi-connect">
              <PlugZap className="h-4 w-4" /> {tr("ui.connect_midi_keyboard")}
            </Button>
            {error && <Callout tone="danger">{error}</Callout>}
          </>
        )}
      </CardBody>
    </Card>
  );
}
