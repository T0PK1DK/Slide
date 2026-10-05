import { describe, expect, it } from "vitest";
import { PRIVATE_KEYS, accountOwner, scopedKey, setAccountOwner } from "./account-store";

describe("per-account private data", () => {
  it("scopes home/work (garage), history, ghosts and XP to the signed-in user", () => {
    setAccountOwner(null);
    expect(scopedKey("slide.garage.v1")).toBe("slide.garage.v1");
    setAccountOwner("user-a");
    expect(accountOwner()).toBe("user-a");
    expect(scopedKey("slide.garage.v1")).toBe("slide.garage.v1.user-a");
    expect(scopedKey("slide.history.v1")).toBe("slide.history.v1.user-a");
    expect(scopedKey("slide.ghosts.v1")).toBe("slide.ghosts.v1.user-a");
    expect(scopedKey("slide.xp.v1")).toBe("slide.xp.v1.user-a");
    setAccountOwner("user-b");
    expect(scopedKey("slide.garage.v1")).toBe("slide.garage.v1.user-b");
    setAccountOwner(null);
  });

  it("copies device Home/Work onto the account the first time, and does not overwrite", () => {
    const mem: Record<string, string> = {
      "slide.garage.v1": JSON.stringify({ home: { label: "Brickell", lon: -80.19, lat: 25.76 } }),
    };
    const store = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v; },
    };
    setAccountOwner("u1", store);
    expect(JSON.parse(mem["slide.garage.v1.u1"]).home.label).toBe("Brickell");
    mem["slide.garage.v1"] = JSON.stringify({ home: { label: "Other" } });
    setAccountOwner("u1", store);
    expect(JSON.parse(mem["slide.garage.v1.u1"]).home.label).toBe("Brickell");
    setAccountOwner(null);
  });

  it("lists every private key we isolate", () => {
    expect(PRIVATE_KEYS).toEqual(expect.arrayContaining([
      "slide.garage.v1",
      "slide.history.v1",
      "slide.ghosts.v1",
      "slide.xp.v1",
    ]));
  });
});
