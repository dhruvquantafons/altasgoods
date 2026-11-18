import { istDateTime } from "../../common/time.js";

/** Paise as plain rupees with two decimals ("1299.00"), no symbol or separators, so spreadsheets read a number. */
export function rupeesCsv(paise: number | null | undefined) {
  if (paise === null || paise === undefined) return "";
  const abs = Math.abs(Math.round(paise));
  return `${paise < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** An IST timestamp as "YYYY-MM-DD HH:mm". */
export const dateCsv = (d: Date | null | undefined) => istDateTime(d);
