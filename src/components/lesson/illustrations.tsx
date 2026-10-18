/* Original, simple line illustrations used by lessons. Theme-aware via CSS variables. */
import type { Visual } from "@/content/types";

type Svg = Extract<Visual, { type: "image-svg" }>["svg"];

const stroke = "var(--text)";
const soft = "var(--muted)";
const accent = "var(--accent)";

function Label({ x, y, children, anchor = "start" }: { x: number; y: number; children: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} fontSize={13} fill="var(--text)" textAnchor={anchor} fontWeight={500}>
      {children}
    </text>
  );
}

function GuitarParts() {
  return (
    <svg viewBox="0 0 640 220" role="img" aria-label="Guitar lying sideways: headstock with tuning pegs on the left, then the nut, the long neck with frets, the body with a sound hole and the bridge on the right." className="h-auto w-full">
      {/* headstock */}
      <path d="M20 90 L80 82 L80 128 L20 120 Z" fill="var(--fret-wood-2)" stroke={stroke} strokeWidth={1.5} />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx={34 + i * 16} cy={76} r={5} fill={soft} />
          <circle cx={34 + i * 16} cy={134} r={5} fill={soft} />
        </g>
      ))}
      <rect x={80} y={84} width={5} height={42} fill="var(--inlay)" stroke={stroke} strokeWidth={0.8} />
      {/* neck */}
      <rect x={85} y={88} width={265} height={34} fill="var(--fret-wood)" stroke={stroke} strokeWidth={1.5} />
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} x1={85 + (i + 1) * 21} x2={85 + (i + 1) * 21} y1={88} y2={122} stroke="var(--fret-wire)" strokeWidth={2} />
      ))}
      {/* body */}
      <path d="M350 60 C 390 30, 450 40, 470 70 C 490 40, 600 30, 620 105 C 600 180, 490 170, 470 140 C 450 170, 390 180, 350 150 C 330 130, 330 80, 350 60 Z" fill="var(--guitar-soft)" stroke={stroke} strokeWidth={2} />
      <circle cx={430} cy={105} r={24} fill="var(--fret-wood-2)" stroke={stroke} strokeWidth={1.5} />
      <rect x={540} y={92} width={14} height={26} rx={3} fill="var(--fret-wood-2)" stroke={stroke} />
      {/* strings */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line key={i} x1={80} x2={548} y1={93 + i * 5} y2={97 + i * 3.4} stroke="var(--string)" strokeWidth={0.8} />
      ))}
      {/* labels */}
      <g stroke={accent} strokeWidth={1}>
        <line x1={45} y1={60} x2={45} y2={36} />
        <line x1={83} y1={128} x2={83} y2={190} />
        <line x1={220} y1={88} x2={220} y2={36} />
        <line x1={430} y1={130} x2={430} y2={190} />
        <line x1={547} y1={92} x2={547} y2={36} />
        <line x1={520} y1={160} x2={600} y2={196} />
      </g>
      <Label x={20} y={28}>Headstock & tuning pegs</Label>
      <Label x={60} y={206}>Nut</Label>
      <Label x={190} y={28}>Neck & frets</Label>
      <Label x={400} y={206}>Sound hole</Label>
      <Label x={520} y={28}>Bridge</Label>
      <Label x={560} y={212}>Body</Label>
    </svg>
  );
}

function PianoParts() {
  const whites = 14;
  const w = 40;
  const blacks = [0, 1, 3, 4, 5];
  return (
    <svg viewBox="0 0 600 230" role="img" aria-label="Two octaves of piano keys. Black keys are grouped in twos and threes; C is just left of each group of two black keys." className="h-auto w-full">
      <g transform="translate(20,40)">
        {Array.from({ length: whites }, (_, i) => (
          <rect key={i} x={i * w} y={0} width={w} height={140} rx={4} fill="var(--key-white)" stroke="var(--key-white-edge)" />
        ))}
        {[0, 7].flatMap((o) => blacks.map((b) => o + b)).map((b) => (
          <rect key={b} x={(b + 1) * w - 12} y={0} width={24} height={88} rx={3} fill="var(--key-black)" />
        ))}
        {[0, 7].map((o) => (
          <g key={o}>
            <rect x={o * w + 2} y={112} width={w - 4} height={24} rx={4} fill="var(--accent-soft)" />
            <text x={o * w + w / 2} y={129} textAnchor="middle" fontSize={13} fontWeight={700} fill={accent}>C</text>
            <path d={`M ${(o + 1) * w - 12} -8 h ${w + 24}`} stroke={accent} strokeWidth={2} />
            <path d={`M ${(o + 4) * w - 12} -8 h ${2 * w + 24}`} stroke="var(--piano)" strokeWidth={2} />
          </g>
        ))}
      </g>
      <Label x={60} y={22}>group of 2</Label>
      <Label x={170} y={22}>group of 3</Label>
      <Label x={20} y={210}>C sits just left of every group of two black keys. The pattern repeats every octave.</Label>
    </svg>
  );
}

function PostureGuitar() {
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label="A seated player: straight back, guitar body resting on the right leg, neck angled slightly upward, feet flat." className="mx-auto h-auto w-full max-w-md">
      <circle cx={140} cy={50} r={20} fill="none" stroke={stroke} strokeWidth={2} />
      <path d="M140 70 L140 150" stroke={stroke} strokeWidth={3} strokeLinecap="round" />
      <path d="M140 150 L200 150 L200 220" stroke={stroke} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M140 150 L180 158 L180 225" stroke={soft} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M110 160 h 60 v 70" stroke={soft} strokeWidth={2} fill="none" />
      {/* guitar */}
      <g transform="rotate(-18 190 130)">
        <ellipse cx={190} cy={135} rx={42} ry={30} fill="var(--guitar-soft)" stroke={stroke} strokeWidth={2} />
        <circle cx={185} cy={135} r={8} fill="var(--fret-wood-2)" />
        <rect x={230} y={130} width={110} height={10} fill="var(--fret-wood)" stroke={stroke} />
      </g>
      <path d="M140 95 L190 125" stroke={stroke} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M140 92 L230 95 L285 85" stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M120 40 L120 150" stroke={accent} strokeDasharray="4 4" />
      <Label x={20} y={30}>Back straight</Label>
      <Label x={220} y={60}>Neck slightly up</Label>
      <Label x={200} y={245}>Feet flat</Label>
    </svg>
  );
}

function PosturePiano() {
  return (
    <svg viewBox="0 0 360 260" role="img" aria-label="A seated pianist: back straight, forearms level with the keys, elbows slightly in front of the body, feet flat on the floor." className="mx-auto h-auto w-full max-w-md">
      <rect x={220} y={110} width={120} height={14} fill="var(--key-white)" stroke="var(--key-white-edge)" />
      <rect x={220} y={124} width={120} height={8} fill="var(--key-black)" />
      <path d="M330 132 v 100" stroke={soft} strokeWidth={3} />
      <circle cx={120} cy={45} r={20} fill="none" stroke={stroke} strokeWidth={2} />
      <path d="M120 65 L120 160" stroke={stroke} strokeWidth={3} strokeLinecap="round" />
      <path d="M120 85 L160 120 L225 116" stroke={stroke} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M120 160 L180 160 L180 230" stroke={stroke} strokeWidth={3} fill="none" strokeLinecap="round" />
      <rect x={80} y={162} width={80} height={10} rx={3} fill="var(--surface-3)" stroke={soft} />
      <path d="M160 116 h 70" stroke={accent} strokeDasharray="4 4" />
      <Label x={175} y={100}>Forearms level</Label>
      <Label x={20} y={30}>Back straight</Label>
      <Label x={80} y={200}>Front half of bench</Label>
      <Label x={190} y={248}>Feet flat</Label>
    </svg>
  );
}

function HandFingers() {
  const fingers = [
    { x: 70, y: 120, h: 50, pn: "1", gn: "T" },
    { x: 110, y: 60, h: 90, pn: "2", gn: "1" },
    { x: 145, y: 45, h: 105, pn: "3", gn: "2" },
    { x: 180, y: 55, h: 95, pn: "4", gn: "3" },
    { x: 212, y: 80, h: 70, pn: "5", gn: "4" },
  ];
  return (
    <svg viewBox="0 0 300 260" role="img" aria-label="An open hand. Piano numbering: thumb 1, index 2, middle 3, ring 4, little 5. Guitar fretting numbering: index 1, middle 2, ring 3, little 4; thumb is T." className="mx-auto h-auto w-full max-w-xs">
      <rect x={90} y={140} width={140} height={90} rx={40} fill="var(--surface-2)" stroke={stroke} strokeWidth={2} />
      {fingers.map((f, i) => (
        <g key={i} transform={i === 0 ? "rotate(-35 70 170)" : undefined}>
          <rect x={f.x - 14} y={f.y} width={28} height={f.h + 20} rx={14} fill="var(--surface-2)" stroke={stroke} strokeWidth={2} />
          <circle cx={f.x} cy={f.y + 16} r={11} fill="var(--piano)" />
          <text x={f.x} y={f.y + 20} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">{f.pn}</text>
          <circle cx={f.x} cy={f.y + 44} r={11} fill="var(--guitar)" />
          <text x={f.x} y={f.y + 48} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">{f.gn}</text>
        </g>
      ))}
      <circle cx={30} cy={245} r={7} fill="var(--piano)" />
      <Label x={42} y={250}>Piano</Label>
      <circle cx={110} cy={245} r={7} fill="var(--guitar)" />
      <Label x={122} y={250}>Guitar (fretting hand)</Label>
    </svg>
  );
}

function SoundWave() {
  const wave = (freq: number, y: number) => {
    const pts: string[] = [];
    for (let x = 0; x <= 520; x += 4) pts.push(`${x + 60},${y + Math.sin((x / 520) * Math.PI * 2 * freq) * 22}`);
    return pts.join(" ");
  };
  return (
    <svg viewBox="0 0 600 200" role="img" aria-label="Two waves: the top one slow (few waves, low pitch), the bottom one fast (many waves, high pitch)." className="h-auto w-full">
      <polyline points={wave(3, 55)} fill="none" stroke="var(--guitar)" strokeWidth={3} />
      <polyline points={wave(9, 145)} fill="none" stroke="var(--piano)" strokeWidth={3} />
      <Label x={6} y={60}>Low</Label>
      <Label x={6} y={150}>High</Label>
      <Label x={590} y={20} anchor="end">slow vibration → low pitch</Label>
      <Label x={590} y={195} anchor="end">fast vibration → high pitch</Label>
    </svg>
  );
}

export function Illustration({ svg }: { svg: Svg }) {
  switch (svg) {
    case "guitar-parts":
      return <GuitarParts />;
    case "piano-parts":
      return <PianoParts />;
    case "posture-guitar":
      return <PostureGuitar />;
    case "posture-piano":
      return <PosturePiano />;
    case "hand-fingers":
      return <HandFingers />;
    case "sound-wave":
      return <SoundWave />;
  }
}
