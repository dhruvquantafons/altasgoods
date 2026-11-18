import type { EmailMessage } from "./email.provider.js";

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** The footer of emails that carry a one-time code. */
const CODE_FOOTER = "AltasGoods will never call you or ask for this code. If you did not ask for it, you can ignore this email.";

interface LayoutOptions {
  /** A one-time code, shown large */
  code?: string;
  /** A button, with the address written out below it for mail apps that block buttons */
  link?: { href: string; label: string };
  /** The small print; defaults to the one-time code warning */
  footer?: string;
}

/** A plain, table based layout that renders the same in Gmail, Outlook and Apple Mail. */
function layout(title: string, paragraphs: string[], { code, link, footer = CODE_FOOTER }: LayoutOptions = {}) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:22px;color:#334155">${escape(p)}</p>`).join("");
  const codeBlock = code
    ? `<p style="margin:8px 0 24px;font-size:32px;line-height:40px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:Menlo,Consolas,monospace">${escape(code)}</p>`
    : "";
  const linkBlock = link
    ? `<p style="margin:8px 0 16px"><a href="${escape(link.href)}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px">${escape(link.label)}</a></p>
<p style="margin:0 0 16px;font-size:12px;line-height:18px;color:#64748b;word-break:break-all">Or open this address: ${escape(link.href)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<tr><td>
<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#1e40af">AltasGoods</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#0f172a">${escape(title)}</h1>
${body}${codeBlock}${linkBlock}
<p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#64748b">${escape(footer)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

export function passwordResetEmail(to: string, code: string, minutes: number): EmailMessage {
  const subject = `${code} is your AltasGoods password reset code`;
  const lines = ["Someone, hopefully you, asked to reset the password for your AltasGoods account.", `Enter this code to choose a new password. It expires in ${minutes} minutes.`];
  return { to, subject, text: `${lines.join("\n\n")}\n\n${code}\n\nIf you did not ask for this, ignore this email. Your password stays the same.`, html: layout("Reset your password", lines, { code }) };
}

export function emailVerificationEmail(to: string, code: string, minutes: number): EmailMessage {
  const subject = `${code} is your AltasGoods verification code`;
  const lines = [`Enter this code to confirm this email address for your AltasGoods account. It expires in ${minutes} minutes.`];
  return { to, subject, text: `${lines[0]}\n\n${code}`, html: layout("Confirm your email", lines, { code }) };
}

export function passwordChangedEmail(to: string): EmailMessage {
  const lines = ["The password for your AltasGoods account was just changed, and every other device was signed out.", "If this was not you, reset your password now from the sign in page and contact AltasGoods support."];
  return { to, subject: "Your AltasGoods password was changed", text: lines.join("\n\n"), html: layout("Password changed", lines, { footer: "AltasGoods will never call you or ask for your password." }) };
}

/** Invites someone to AltasGoods Control: the link lets them choose a password and signs them in. */
export function staffInviteEmail(to: string, name: string | null, link: string, hours: number): EmailMessage {
  const lines = [
    `${name ? `Hello ${name}, you` : "You"} have been added to AltasGoods Control, where the AltasGoods team runs the store.`,
    `Choose a password to finish setting up your account. This link works once and expires in ${hours} hours.`,
  ];
  const footer = "You got this email because a Super Admin added you to AltasGoods Control. If you were not expecting it, ignore this email and nothing will change.";
  return {
    to,
    subject: "You have been invited to AltasGoods Control",
    text: `${lines.join("\n\n")}\n\n${link}\n\n${footer}`,
    html: layout("Set up your staff account", lines, { link: { href: link, label: "Choose a password" }, footer }),
  };
}
