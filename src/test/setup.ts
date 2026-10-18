import "fake-indexeddb/auto";
import { afterEach } from "vitest";

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom without storage */
  }
});
