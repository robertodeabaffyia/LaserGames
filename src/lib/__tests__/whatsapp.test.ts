import { buildWhatsAppLink } from "../whatsapp";

describe("buildWhatsAppLink", () => {
  it("strips formatting characters from the phone", () => {
    expect(buildWhatsAppLink("+54 9 387 1234567")).toBe(
      "https://wa.me/5493871234567"
    );
  });

  it("strips a leading 00 international prefix", () => {
    expect(buildWhatsAppLink("0054 9 387 1234567")).toBe(
      "https://wa.me/5493871234567"
    );
  });

  it("appends the encoded message as text param", () => {
    const link = buildWhatsAppLink("+54 9 387 1234567", "Hola, ¿cómo estás?");
    expect(link).toBe(
      `https://wa.me/5493871234567?text=${encodeURIComponent("Hola, ¿cómo estás?")}`
    );
  });

  it("returns null for null/undefined/empty phone", () => {
    expect(buildWhatsAppLink(null)).toBeNull();
    expect(buildWhatsAppLink(undefined)).toBeNull();
    expect(buildWhatsAppLink("")).toBeNull();
  });

  it("returns null when fewer than 7 digits", () => {
    expect(buildWhatsAppLink("12 34 56")).toBeNull();
  });
});
