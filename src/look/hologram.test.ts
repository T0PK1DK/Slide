import { describe, expect, it } from "vitest";
import {
  clearHologramRenderers,
  defaultHologramMarkup,
  mountHologram,
  registerHologramRenderer,
  resolveHologramRenderer,
} from "./hologram";

function fakeEl(): HTMLElement {
  const flags = new Set<string>();
  const el = {
    innerHTML: "",
    replaceChildren() {
      this.innerHTML = "";
    },
    classList: {
      add: (n: string) => flags.add(n),
      toggle: (n: string, on?: boolean) => {
        if (on) flags.add(n);
        else flags.delete(n);
      },
      contains: (n: string) => flags.has(n),
    },
  };
  return el as unknown as HTMLElement;
}

describe("hologram slot", () => {
  it("paints a rotating outline by default", () => {
    const html = defaultHologramMarkup({ modelKey: "walmart", color: "#0071ce" });
    expect(html).toContain("data-model-key=\"walmart\"");
    expect(html).toContain("#0071ce");
    expect(html).toContain("look-holo-outline");
    expect(html).toContain("look-holo-scan");
    expect(html).toContain("<ellipse");
  });

  it("lets Leon register a model renderer and a wildcard", () => {
    clearHologramRenderers();
    const seen: string[] = [];
    const stop = registerHologramRenderer("walmart", (el, opts) => {
      el.innerHTML = `model:${opts.modelKey}`;
      seen.push(opts.modelKey);
      return () => seen.push("dispose");
    });
    registerHologramRenderer("*", (el) => {
      el.innerHTML = "wild";
    });
    expect(resolveHologramRenderer("walmart") === resolveHologramRenderer("publix")).toBe(false);
    const el = fakeEl();
    const dispose = mountHologram(el, { modelKey: "walmart", color: "#0071ce" });
    expect(el.innerHTML).toBe("model:walmart");
    dispose();
    expect(seen).toContain("dispose");
    const other = fakeEl();
    mountHologram(other, { modelKey: "generic-grocery", color: "#3d8b37" });
    expect(other.innerHTML).toBe("wild");
    stop();
    clearHologramRenderers();
  });
});
