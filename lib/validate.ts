import { NextResponse } from "next/server";
import { ZodSchema, ZodError } from "zod";

export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T }
  | { success: false; response: NextResponse } {
  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (err) {
    if (err instanceof ZodError) {
      const formatted = err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      return {
        success: false,
        response: NextResponse.json(
          { error: "Validation failed", details: formatted },
          { status: 400 }
        ),
      };
    }
    return {
      success: false,
      response: NextResponse.json(
        { error: "Validation error" },
        { status: 400 }
      ),
    };
  }
}
