import { describe, expect, it } from "vitest";
import { AUTH_SITE_URL, authRedirectUrl, authReturn } from "./cloud";

describe("authReturn (emailed sign-in link)", () => {
  it("spots tokens in the hash (implicit flow) and a PKCE code", () => {
    expect(authReturn("#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=magiclink", "")).toEqual({ kind: "session" });
    expect(authReturn("", "?code=1b2c")).toEqual({ kind: "session" });
  });
  it("reports an expired or bad link", () => {
    expect(authReturn("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired", ""))
      .toEqual({ kind: "error", message: "Email link is invalid or has expired" });
  });
  it("ignores a normal load", () => {
    expect(authReturn("", "")).toBeNull();
    expect(authReturn("#map", "?utm=x")).toBeNull();
  });
});

describe("authRedirectUrl", () => {
  it("pins production and keeps preview hosts", () => {
    expect(authRedirectUrl("https://kings-slide.pages.dev", "/foo")).toBe(`${AUTH_SITE_URL}/`);
    expect(authRedirectUrl("https://grim-polish.kings-slide.pages.dev")).toBe("https://grim-polish.kings-slide.pages.dev/");
  });
});
