/**
 * Make the given argument of unknown type into something human-readable.
 * For Error objects, you can specify options to make the string more verbose.
 */
export function toReadableString(
  u: unknown,
  options?: { includeStack?: boolean; includeErrorProps?: boolean },
): string {
  if (typeof u === "string") {
    return u;
  }

  if (u instanceof Error) {
    const error = u as Error;
    let result = "";

    // Always include the name and message
    const errorName = error.name || "Error";
    const errorMessage =
      error.message || "An error occurred with no message provided.";

    result += `${errorName}: ${errorMessage}`;

    // Optionally include the stack trace
    if (options?.includeStack && error.stack) {
      // Clean up the stack trace to start on a new line,
      // removing potential duplicate header lines if the browser adds them.
      const stack = error.stack
        // Remove the first line if it duplicates the name/message
        .replace(new RegExp(`^${errorName}:.*\\n?`), "")
        .trim();

      if (stack) {
        result += `\nStack Trace:\n${stack}`;
      }
    }

    // Add any potential custom error properties (e.g., HTTP status code)
    if (options?.includeErrorProps) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const customProps: { [key: string]: unknown } = error as any;

      const additionalInfo = Object.keys(customProps)
        .filter(
          (key) =>
            key !== "name" &&
            key !== "message" &&
            key !== "stack" &&
            typeof customProps[key] !== "function" &&
            typeof customProps[key] !== "object",
        )
        .map((key) => `\n- ${key}: ${customProps[key]}`);

      if (additionalInfo.length > 0) {
        result += `\nAdditional Data:${additionalInfo.join("")}`;
      }
    }

    return result;
  }

  // If the object has a custom toString(), then use it.
  if (
    u !== null &&
    typeof u === "object" &&
    u.toString !== Object.prototype.toString
  ) {
    return u.toString();
  }

  try {
    // Attempt to JSON stringify the object for inspection.
    return JSON.stringify(u);
  } catch {
    // Fallback if the object cannot be stringified (e.g., circular references).
    return String(u);
  }
}
