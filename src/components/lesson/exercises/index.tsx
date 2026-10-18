"use client";

import type { Exercise } from "@/content/types";
import type { ExerciseOutcome, Inst } from "../utils";
import { PlaySequenceExercise } from "./play-sequence";
import { FindAllExercise } from "./find-all";
import { PlayChordExercise } from "./play-chord";
import { EarChoiceExercise } from "./ear-choice";
import { TapRhythmExercise } from "./tap-rhythm";
import { NameNoteExercise } from "./name-note";
import { MicNoteExercise } from "./mic-note";

export function ExerciseRenderer(props: {
  exercise: Exercise;
  instrument: Inst;
  track: "theory" | "guitar" | "piano";
  passAccuracy?: number;
  onComplete: (o: ExerciseOutcome) => void;
  onActivity?: () => void;
}) {
  const { exercise: e, ...rest } = props;
  switch (e.type) {
    case "play-sequence":
      return <PlaySequenceExercise exercise={e} {...rest} />;
    case "find-all":
      return <FindAllExercise exercise={e} {...rest} />;
    case "play-chord":
      return <PlayChordExercise exercise={e} {...rest} />;
    case "ear-choice":
      return <EarChoiceExercise exercise={e} {...rest} />;
    case "tap-rhythm":
      return <TapRhythmExercise exercise={e} {...rest} />;
    case "name-note":
      return <NameNoteExercise exercise={e} {...rest} />;
    case "mic-note":
      return <MicNoteExercise exercise={e} {...rest} />;
  }
}
