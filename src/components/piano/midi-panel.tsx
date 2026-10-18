"use client";

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
  return (
    <Card>
      <CardHeader
        icon={<Cable className="h-5 w-5" />}
        title="MIDI keyboard"
        description="Optional. Gives exact notes and timing — more reliable than a microphone."
        action={status === "connected" ? <Badge tone="success">Connected</Badge> : undefined}
      />
      <CardBody className="space-y-3">
        {!supported ? (
          <Callout tone="warn" title="Web MIDI isn't available in this browser">
            Use Chrome, Edge or Opera on a desktop computer (Firefox 108+ also works). Safari and iOS don&apos;t support Web MIDI — the on-screen keys and your computer keyboard still work fine.
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
              <p className="text-sm text-muted">Access granted, but no keyboard is plugged in. Connect one by USB — it will appear here automatically.</p>
            )}
            <p className="text-sm" aria-live="polite">
              <span className="text-muted">Incoming notes: </span>
              <span className="font-medium">{held.size ? [...held].sort((a, b) => a - b).map((m) => midiToName(m)).join(", ") : "—"}</span>
            </p>
            <Button size="sm" variant="ghost" onClick={onDisconnect}>
              <Unplug className="h-4 w-4" /> Disconnect
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">Plug your keyboard in by USB (or a USB-MIDI adapter) first, then connect. Your browser will ask for permission.</p>
            <Button size="sm" onClick={onConnect} loading={status === "connecting"} data-testid="midi-connect">
              <PlugZap className="h-4 w-4" /> Connect MIDI keyboard
            </Button>
            {error && <Callout tone="danger">{error}</Callout>}
          </>
        )}
      </CardBody>
    </Card>
  );
}
