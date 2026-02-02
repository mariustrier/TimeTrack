import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

interface ApiErrorOptions {
  status?: number;
  label?: string;
  expose?: boolean;
}

export function apiError(
  error: unknown,
  { status = 500, label = "API", expose = false }: ApiErrorOptions = {}
): NextResponse {
  console.error(`[${label}]`, error);

  if (status >= 500) {
    Sentry.captureException(error);
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const message =
    expose && error instanceof Error ? error.message : "Internal server error";

  return NextResponse.json({ error: message }, { status });
}
