// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const process: any;

export class MissingEnvVarError extends Error {}

/**
 * Get an environment variable by name. If a default value is not given, and
 * the variable is empty or missing, throw MissingEnvVarError.
 *
 * If an empty string is acceptable, pass `defaultValue` as "".
 */
export function getEnv(varName: string, defaultValue?: string | null): string {
  try {
    const value = process?.env?.[varName];

    // This value should always be a string, unless the user sets it otherwise,
    // which is an unusual case.
    if (value) return value;
  } catch {
    // ignore
  }

  if (typeof defaultValue !== "string") {
    throw new MissingEnvVarError(`Missing process.env.${varName}`);
  }

  return defaultValue;
}
