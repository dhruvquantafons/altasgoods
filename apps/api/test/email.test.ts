import { createTransport } from "nodemailer";
import { describe, expect, it } from "vitest";
import { SmtpEmailProvider } from "../src/modules/auth/email.provider.js";
import { passwordResetEmail } from "../src/modules/auth/emails.js";

const config = { SMTP_HOST: "smtp.example.com", SMTP_PORT: 587, SMTP_SECURE: undefined, SMTP_USER: "apikey", SMTP_PASSWORD: "secret", EMAIL_FROM: "AltasGoods <no-reply@altasgoods.in>" };

describe("SMTP email", () => {
  it("sends from the configured sender with text and HTML parts", async () => {
    const transport = createTransport({ jsonTransport: true });
    const sent: string[] = [];
    const original = transport.sendMail.bind(transport);
    transport.sendMail = (async (mail: Parameters<typeof original>[0]) => {
      const info = await original(mail);
      sent.push((info as unknown as { message: string }).message);
      return info;
    }) as typeof transport.sendMail;

    await new SmtpEmailProvider(config, transport).send(passwordResetEmail("ananya@example.com", "123456", 10));
    const message = JSON.parse(sent[0]!);
    expect(message.from).toEqual({ address: "no-reply@altasgoods.in", name: "AltasGoods" });
    expect(message.to).toEqual([{ address: "ananya@example.com", name: "" }]);
    expect(message.subject).toBe("123456 is your AltasGoods password reset code");
    expect(message.text).toContain("123456");
    expect(message.html).toContain("123456");
  });

  it("passes a failed send on to the caller", async () => {
    const transport = createTransport({ jsonTransport: true });
    transport.sendMail = (async () => {
      throw new Error("535 Authentication failed");
    }) as typeof transport.sendMail;
    await expect(new SmtpEmailProvider(config, transport).send(passwordResetEmail("a@example.com", "123456", 10))).rejects.toThrow("535");
  });
});
