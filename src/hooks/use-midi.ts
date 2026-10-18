"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHydrated } from "./use-prefs";
import { connectMidi, midiSupported, type MidiConnection, type MidiNoteEvent } from "@/lib/audio/midi";

export function useMidi(onNote?: (e: MidiNoteEvent) => void) {
  const [devices, setDevices] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [held, setHeld] = useState<Set<number>>(new Set());
  const conn = useRef<MidiConnection | null>(null);
  const cb = useRef(onNote);
  useEffect(() => {
    cb.current = onNote;
  });
  const supported = useHydrated() && midiSupported();

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      conn.current?.close();
      conn.current = await connectMidi(
        (e) => {
          setHeld((h) => {
            const n = new Set(h);
            if (e.type === "on") n.add(e.midi);
            else n.delete(e.midi);
            return n;
          });
          cb.current?.(e);
        },
        setDevices,
      );
      setStatus("connected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not access MIDI devices.");
      setStatus("error");
    }
  }, []);

  const disconnect = useCallback(() => {
    conn.current?.close();
    conn.current = null;
    setStatus("idle");
    setDevices([]);
    setHeld(new Set());
  }, []);

  useEffect(() => () => conn.current?.close(), []);

  return { supported, devices, status, error, held, connect, disconnect };
}
