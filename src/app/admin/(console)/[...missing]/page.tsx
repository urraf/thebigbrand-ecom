import { notFound } from "next/navigation";

/** Unknown URL inside this area → its own styled 404 (with the area's chrome) instead of the bare default. */
export const instant = false; // a 404 can't be prerendered for instant navigation — opt out of validation

export default function Missing() {
  notFound();
}
