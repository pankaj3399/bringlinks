import { validateEnv } from "../../../config/validateEnv";

export const parseAllowedStates = (): string[] => {
  const raw = validateEnv.ALLOWED_STATES || "";
  return raw
    .split(",")
    .map((s: string) => s.trim().toLowerCase())
    .filter((s: string) => !!s);
};
