/**
 * Pure state machine driving the search bar's animated placeholder — typed
 * out a character at a time, held, then deleted before the next phrase
 * starts. Kept separate from the setTimeout loop that drives it so the
 * cycling logic itself is testable without fake timers.
 */
export type TypewriterPhase = "typing" | "pausing" | "deleting";

export type TypewriterState = {
  phraseIndex: number;
  charCount: number;
  phase: TypewriterPhase;
};

export function initialTypewriterState(): TypewriterState {
  return { phraseIndex: 0, charCount: 0, phase: "typing" };
}

export function nextTypewriterState(state: TypewriterState, phrases: string[]): TypewriterState {
  const phrase = phrases[state.phraseIndex % phrases.length] ?? "";

  if (state.phase === "typing") {
    if (state.charCount < phrase.length) return { ...state, charCount: state.charCount + 1 };
    return { ...state, phase: "pausing" };
  }

  if (state.phase === "pausing") {
    return { ...state, phase: "deleting" };
  }

  // deleting
  if (state.charCount > 0) return { ...state, charCount: state.charCount - 1 };
  return { phraseIndex: (state.phraseIndex + 1) % phrases.length, charCount: 0, phase: "typing" };
}

/** How long to wait before the *next* tick, given the state just entered. */
export function tickDelayMs(state: TypewriterState): number {
  if (state.phase === "pausing") return 2000;
  return 70;
}

export function displayedText(state: TypewriterState, phrases: string[]): string {
  const phrase = phrases[state.phraseIndex % phrases.length] ?? "";
  return phrase.slice(0, state.charCount);
}
