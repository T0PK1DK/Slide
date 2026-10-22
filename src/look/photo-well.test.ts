import { describe, expect, it } from "vitest";
import { PLACE_EMPTY } from "./empty";
import { LOOK_FIXTURES, placeFor } from "./fixtures";
import { sampleLogo, samplePhoto } from "./photos";
import { classifyPhoto, markPhotoFallback, photoCaption } from "./photo-well";

describe("photo well", () => {
  it("captions Wikimedia-style marks as Logo and stills as Photo", () => {
    expect(classifyPhoto({ url: sampleLogo("Wa", "#0071ce").url! })).toBe("logo");
    expect(classifyPhoto({ url: samplePhoto("facade", "Front lot").url! })).toBe("photo");
    expect(
      classifyPhoto({
        url: "https://commons.wikimedia.org/wiki/Special:FilePath/Walmart_logo.svg",
        credit: "Wikimedia",
      }),
    ).toBe("logo");
    expect(classifyPhoto({ url: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Storefront.jpg" })).toBe("photo");
    expect(classifyPhoto({ url: "https://example.com/shot.jpg", width: 96, height: 96 })).toBe("logo");
    expect(photoCaption("logo")).toBe(PLACE_EMPTY.logoCaption);
    expect(photoCaption("photo")).toBe(PLACE_EMPTY.photoCaption);
  });

  it("swaps a broken image for the empty well", () => {
    const walmart = LOOK_FIXTURES.stores.find((s) => s.brandKey === "walmart")!;
    expect(placeFor(walmart)?.photos?.[0]?.url).toContain("image/svg");
    const caption = { textContent: "Photo" };
    const removed: string[] = [];
    const state = { className: "look-photo is-photo" };
    const node = {
      classList: {
        add(name: string) {
          state.className += ` ${name}`;
        },
        remove(...names: string[]) {
          for (const n of names) state.className = state.className.replace(n, "").trim();
        },
      },
      querySelector(sel: string) {
        if (sel === "img") return { remove() { removed.push("img"); } };
        if (sel === "figcaption") return caption;
        return null;
      },
    };
    markPhotoFallback(node as unknown as HTMLElement);
    expect(state.className).toContain("is-fallback");
    expect(caption.textContent).toBe(PLACE_EMPTY.photoFailed);
    expect(removed).toContain("img");
  });
});
