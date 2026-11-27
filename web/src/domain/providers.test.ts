import { describe, expect, it } from "vitest";
import { providerFromHost } from "./providers";

describe("providerFromHost", () => {
  it.each([
    ["imap.gmail.com", "gmail"],
    [" IMAP.GoogleMail.com ", "gmail"],
    ["outlook.office365.com", "office365"],
    ["imap-mail.outlook.com", "office365"],
    ["imap.example.com", "imap"],
    ["gmail.com.evil.example", "imap"],
    ["notgmail.com", "imap"],
    ["", "imap"],
  ])("%s is %s", (host, provider) => expect(providerFromHost(host)).toBe(provider));
});
