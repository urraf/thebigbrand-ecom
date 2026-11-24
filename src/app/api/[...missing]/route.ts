import { NextResponse } from "next/server";

/** Unknown API paths return JSON (mobile apps never receive an HTML 404 page). */
function notFound() {
  return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown API endpoint" } }, { status: 404 });
}
export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
