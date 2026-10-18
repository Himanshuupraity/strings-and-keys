"use client";

/**
 * Web MIDI input. Supported in Chromium-based browsers (Chrome, Edge, Opera) and Firefox 108+ on
 * secure origins. Not supported in Safari (as of writing) — the UI explains this.
 */
export interface MidiNoteEvent {
  type: "on" | "off";
  midi: number;
  velocity: number;
  device: string;
  time: number;
}

export function midiSupported(): boolean {
  return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
}

export interface MidiConnection {
  inputs: string[];
  close: () => void;
}

export async function connectMidi(onNote: (e: MidiNoteEvent) => void, onDevicesChange?: (names: string[]) => void): Promise<MidiConnection> {
  if (!midiSupported()) throw new Error("Web MIDI is not supported in this browser. Try Chrome or Edge on desktop.");
  const access = await navigator.requestMIDIAccess({ sysex: false });
  const bound = new Set<MIDIInput>();

  const handler = (input: MIDIInput) => (msg: MIDIMessageEvent) => {
    const data = msg.data;
    if (!data || data.length < 3) return;
    const status = data[0] & 0xf0;
    const note = data[1];
    const vel = data[2];
    if (status === 0x90 && vel > 0) onNote({ type: "on", midi: note, velocity: vel / 127, device: input.name ?? "MIDI", time: msg.timeStamp });
    else if (status === 0x80 || (status === 0x90 && vel === 0)) onNote({ type: "off", midi: note, velocity: 0, device: input.name ?? "MIDI", time: msg.timeStamp });
  };

  const bindAll = () => {
    access.inputs.forEach((input) => {
      if (bound.has(input)) return;
      input.onmidimessage = handler(input);
      bound.add(input);
    });
    const names = [...access.inputs.values()].filter((i) => i.state === "connected").map((i) => i.name ?? "MIDI device");
    onDevicesChange?.(names);
    return names;
  };

  const names = bindAll();
  access.onstatechange = () => bindAll();

  return {
    inputs: names,
    close: () => {
      bound.forEach((i) => (i.onmidimessage = null));
      access.onstatechange = null;
      bound.clear();
    },
  };
}
