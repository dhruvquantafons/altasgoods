import { z } from "zod";
import { STAFF_ROLES } from "../../db/schema.js";

const roles = z
  .array(z.enum(STAFF_ROLES))
  .min(1, "Pick at least one role")
  .max(STAFF_ROLES.length)
  // no repeats, in the usual order
  .transform((r) => STAFF_ROLES.filter((x) => r.includes(x)))
  .describe("AltasGoods Control roles; Super Admin passes every check");

export const staffMember = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  email: z.string(),
  roles: z.array(z.string()),
  status: z.enum(["ACTIVE", "BLOCKED"]).describe("BLOCKED is disabled: cannot sign in"),
  mustChangePassword: z.boolean().describe("Holds a temporary password that has not been changed yet"),
  invitePending: z.boolean().describe("An invite link was sent and has not been used or expired"),
  lastActiveAt: z.iso.datetime().nullable().describe("When they last signed in or their session was renewed"),
  createdAt: z.iso.datetime(),
});

export const staffCreateBody = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("invite").describe("Email a one-time link to choose a password"),
    name: z.string().trim().min(2, "Enter their full name").max(80),
    email: z.email("Enter a valid email address").max(120),
    roles,
  }),
  z.object({
    mode: z.literal("password").describe("Set a temporary password to hand over; it must be changed at first sign in"),
    name: z.string().trim().min(2, "Enter their full name").max(80),
    email: z.email("Enter a valid email address").max(120),
    roles,
    tempPassword: z.string().min(8, "Use at least 8 characters").max(128),
  }),
]);

export const staffCreateResponse = z.object({
  member: staffMember,
  inviteLink: z.string().optional().describe("Only when no email really goes out (development, or the console email provider): the link to pass on by hand"),
});

export const staffRolesBody = z.object({ roles });

export const staffInviteResponse = z.object({
  member: staffMember,
  inviteLink: z.string().optional().describe("Only when no email really goes out"),
});
