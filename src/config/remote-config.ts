/**
 * Remote Config schema — every key the app reads, its type, safe default and purpose.
 * Values are edited in Firebase console → Remote Config without a deploy; anything
 * missing, unpublished or malformed falls back to the default here.
 *
 * Remote Config values are public (the browser downloads them). Never store secrets here.
 * To add a key: add it below, then publish it in the console (or import the template
 * from /api/remote-config/template in development).
 */

export type Announcement = {
  /** Empty text hides the banner. */
  text: string;
  href?: string;
  tone?: "info" | "success" | "warning";
};

type Param<T> = {
  type: "boolean" | "number" | "string" | "json";
  default: T;
  description: string;
  /** Rejects bad values (e.g. malformed JSON) so they fall back to the default. */
  validate?: (value: unknown) => boolean;
};

function param<T>(p: Param<T>) {
  return p;
}

export const REMOTE_CONFIG = {
  google_health_enabled: param({
    type: "boolean",
    default: true,
    description: "Kill switch for Google Health: hides Activity and blocks connect/sync when false.",
  }),
  activity_auto_sync_minutes: param({
    type: "number",
    default: 60,
    description: "Auto-sync Google Health when the Activity page is opened and data is older than this.",
    validate: (v) => typeof v === "number" && v >= 5 && v <= 24 * 60,
  }),
  announcement: param<Announcement>({
    type: "json",
    default: { text: "" },
    description: 'Site-wide banner, e.g. {"text":"New: sleep tracking","href":"/activity","tone":"info"}. Empty text hides it.',
    validate: (v) =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Announcement).text === "string" &&
      ((v as Announcement).href === undefined || typeof (v as Announcement).href === "string") &&
      ((v as Announcement).tone === undefined || ["info", "success", "warning"].includes((v as Announcement).tone!)),
  }),
  hero_title: param({
    type: "string",
    default: "Your workouts and diet, *finally in one place.*",
    description: "Landing page headline. Wrap words in *asterisks* to highlight them.",
    validate: (v) => typeof v === "string" && v.trim().length > 0,
  }),
  hero_cta_text: param({
    type: "string",
    default: "Get started",
    description: "Landing page primary button text (good A/B test candidate).",
    validate: (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 40,
  }),
};

export type RemoteConfigKey = keyof typeof REMOTE_CONFIG;
export type RemoteConfigValues = { [K in RemoteConfigKey]: (typeof REMOTE_CONFIG)[K]["default"] };

export const REMOTE_CONFIG_DEFAULTS = Object.fromEntries(
  Object.entries(REMOTE_CONFIG).map(([k, p]) => [k, p.default]),
) as RemoteConfigValues;

/** Remote Config sends every value as a string; this converts and validates one. */
function parse(key: RemoteConfigKey, raw: string | undefined): unknown {
  const p = REMOTE_CONFIG[key] as Param<unknown>;
  if (raw === undefined) return p.default;
  let value: unknown;
  switch (p.type) {
    case "boolean":
      // Same truthy strings as the Firebase SDK's asBoolean().
      value = ["1", "true", "t", "yes", "y", "on"].includes(raw.toLowerCase());
      break;
    case "number":
      value = raw.trim() === "" ? NaN : Number(raw);
      if (!Number.isFinite(value)) return p.default;
      break;
    case "json":
      try {
        value = JSON.parse(raw);
      } catch {
        return p.default;
      }
      break;
    default:
      value = raw;
  }
  return p.validate && !p.validate(value) ? p.default : value;
}

/** Builds typed values from raw Remote Config entries, using defaults for anything missing or invalid. */
export function resolveRemoteConfig(entries: Record<string, string> = {}): RemoteConfigValues {
  return Object.fromEntries(
    (Object.keys(REMOTE_CONFIG) as RemoteConfigKey[]).map((k) => [k, parse(k, entries[k])]),
  ) as RemoteConfigValues;
}

/** The schema as a Remote Config template file (Firebase console → ⋮ → Publish from a file). */
export function remoteConfigTemplate() {
  const valueType = { boolean: "BOOLEAN", number: "NUMBER", string: "STRING", json: "JSON" } as const;
  return {
    parameters: Object.fromEntries(
      Object.entries(REMOTE_CONFIG).map(([k, p]) => [
        k,
        {
          defaultValue: { value: typeof p.default === "string" ? p.default : JSON.stringify(p.default) },
          description: p.description,
          valueType: valueType[p.type],
        },
      ]),
    ),
  };
}
