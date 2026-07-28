import { describe, expect, it } from "vitest";
import { displayedText, initialTypewriterState, nextTypewriterState, tickDelayMs, type TypewriterState } from "./typewriter-core";

const PHRASES = ["Hi", "Yo"];

function run(state: TypewriterState, ticks: number): TypewriterState {
  let s = state;
  for (let i = 0; i < ticks; i++) s = nextTypewriterState(s, PHRASES);
  return s;
}

describe("typewriter-core", () => {
  it("types one character per tick", () => {
    let state = initialTypewriterState();
    state = nextTypewriterState(state, PHRASES);
    expect(displayedText(state, PHRASES)).toBe("H");
    state = nextTypewriterState(state, PHRASES);
    expect(displayedText(state, PHRASES)).toBe("Hi");
  });

  it("moves to pausing once the phrase is fully typed", () => {
    const state = run(initialTypewriterState(), 2);
    expect(state.phase).toBe("typing");
    const next = nextTypewriterState(state, PHRASES);
    expect(next.phase).toBe("pausing");
    expect(displayedText(next, PHRASES)).toBe("Hi");
  });

  it("deletes one character per tick after pausing", () => {
    let state = run(initialTypewriterState(), 3); // "H", "Hi", pausing
    state = nextTypewriterState(state, PHRASES); // -> deleting, "Hi"
    expect(state.phase).toBe("deleting");
    state = nextTypewriterState(state, PHRASES);
    expect(displayedText(state, PHRASES)).toBe("H");
  });

  it("advances to the next phrase once fully deleted, wrapping around", () => {
    // type "H","Hi" (2 ticks) -> pause (1) -> deleting "Hi"->"H"->"" (2) ->
    // wrap on the tick that finds charCount already 0 (1) = 7 ticks.
    let state = run(initialTypewriterState(), 7);
    expect(state.phraseIndex).toBe(1);
    expect(state.phase).toBe("typing");
    expect(displayedText(state, PHRASES)).toBe("");

    // Cycle through the second phrase and wrap back to index 0.
    state = run(state, 7);
    expect(state.phraseIndex).toBe(0);
  });

  it("pauses much longer than it types or deletes", () => {
    const typing = { phraseIndex: 0, charCount: 1, phase: "typing" as const };
    const pausing = { phraseIndex: 0, charCount: 2, phase: "pausing" as const };
    const deleting = { phraseIndex: 0, charCount: 1, phase: "deleting" as const };
    expect(tickDelayMs(pausing)).toBeGreaterThan(tickDelayMs(typing));
    expect(tickDelayMs(pausing)).toBeGreaterThan(tickDelayMs(deleting));
  });
});
