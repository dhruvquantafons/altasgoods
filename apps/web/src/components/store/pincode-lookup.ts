"use client";

import { useEffect, useState } from "react";
import { checkPincode } from "@/app/actions/pincode";
import { isValidPincode, type PincodeInfo } from "./delivery";

/** Answers are reused for a few minutes so moving between pages does not re-ask. */
const TTL_MS = 5 * 60_000;
const answers = new Map<string, { info: PincodeInfo | null; at: number }>();
const inflight = new Map<string, Promise<PincodeInfo | null>>();

/**
 * Whether the store delivers to a pincode, from the API. Null for a malformed
 * pincode or when the API cannot be reached (callers then assume nothing).
 */
export async function lookupPincode(pin: string): Promise<PincodeInfo | null> {
  if (!isValidPincode(pin)) return null;
  const hit = answers.get(pin);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.info;
  let pending = inflight.get(pin);
  if (!pending) {
    pending = checkPincode(pin)
      .then((info) => {
        // an unreachable API is not worth remembering
        if (info) answers.set(pin, { info, at: Date.now() });
        return info;
      })
      .finally(() => inflight.delete(pin));
    inflight.set(pin, pending);
  }
  return pending;
}

/** The delivery answer for a pincode; `loading` until the API has replied. */
export function usePincodeInfo(pin: string | null | undefined) {
  const [state, setState] = useState<{ pin: string | null; info: PincodeInfo | null }>({ pin: null, info: null });
  const valid = pin && isValidPincode(pin) ? pin : null;

  useEffect(() => {
    if (!valid) return;
    let live = true;
    void lookupPincode(valid).then((info) => live && setState({ pin: valid, info }));
    return () => {
      live = false;
    };
  }, [valid]);

  const loading = !!valid && state.pin !== valid;
  return { info: valid && state.pin === valid ? state.info : null, loading };
}
