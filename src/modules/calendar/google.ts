import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Minimal Google Calendar API v3 client using a service account.
 * No SDK: a signed JWT is exchanged for an access token, then plain REST.
 *
 * Configure with env vars (see README "Google Calendar push"):
 *   GOOGLE_SERVICE_ACCOUNT_JSON  path to the key file, or the JSON itself
 *   GOOGLE_CALENDAR_ID_PROJECTS  calendar id shared with the service account
 *   GOOGLE_CALENDAR_ID_RENTALS   optional second calendar for rentals
 *
 * With a `subject` the client acts as that Workspace user (domain-wide
 * delegation, granted by a Workspace admin): calendar entries are created
 * in the person's own calendar and Google sends the invitations.
 */
type ServiceAccount = { client_email: string; private_key: string; client_id?: string };

export type GoogleEvent = {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  attendees?: { email: string }[];
  source?: { title: string; url: string };
};

export function googleConfig() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const projects = process.env.GOOGLE_CALENDAR_ID_PROJECTS;
  const rentals = process.env.GOOGLE_CALENDAR_ID_RENTALS;
  if (!raw || !projects) return null;
  let account: ServiceAccount;
  try {
    account = JSON.parse(raw.trim().startsWith("{") ? raw : readFileSync(raw, "utf8"));
  } catch {
    return null;
  }
  return { account, calendars: { projects, rentals: rentals ?? null } };
}

/** The service account's client id: what a Workspace admin enters for domain-wide delegation. */
export function serviceAccountClientId(): string | null {
  return googleConfig()?.account.client_id ?? null;
}

/** The scope the delegation must allow. */
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function isGoogleConfigured(): boolean {
  return googleConfig() !== null;
}

/** People API scopes for guest suggestions; the delegation must allow them too (README, Google Calendar push). */
export const PEOPLE_SCOPES = ["contacts.readonly", "contacts.other.readonly", "directory.readonly"].map((s) => `https://www.googleapis.com/auth/${s}`);

/** Tokens per scope and acting user ("" = the service account itself). */
const tokens = new Map<string, { value: string; expiresAt: number }>();

/** Thrown when Google refuses to let the service account act as a user (no delegation, or not a Workspace address). */
export class GoogleDelegationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleDelegationError";
  }
}

async function accessToken(account: ServiceAccount, fetchImpl: typeof fetch, subject?: string, scope = CALENDAR_SCOPE): Promise<string> {
  const key = `${scope}|${subject ?? ""}`;
  const cached = tokens.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: account.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    ...(subject ? { sub: subject } : {}),
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (subject && (res.status === 400 || res.status === 401 || res.status === 403)) throw new GoogleDelegationError(`Google refused to act as ${subject}: ${res.status} ${text.slice(0, 200)}`);
    throw new Error(`Google token request failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  tokens.set(key, { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

export class GoogleCalendar {
  constructor(
    private readonly account: ServiceAccount,
    private readonly fetchImpl: typeof fetch = fetch,
    /** Act as this Workspace user (domain-wide delegation). */
    private readonly subject?: string,
  ) {}

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await accessToken(this.account, this.fetchImpl, this.subject);
    return this.fetchImpl(`https://www.googleapis.com/calendar/v3${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  }

  /** Create or update; returns the event id. Retries without attendees if the account may not invite. `sendUpdates`: Google emails the attendees (invitations, changes). */
  async upsert(calendarId: string, eventId: string | null, event: GoogleEvent, opts: { sendUpdates?: boolean } = {}): Promise<string> {
    const q = opts.sendUpdates ? "?sendUpdates=all" : "";
    const path = `/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ""}${q}`;
    let res = await this.call(eventId ? "PUT" : "POST", path, event);
    if (res.status === 404 && eventId) {
      res = await this.call("POST", `/calendars/${encodeURIComponent(calendarId)}/events${q}`, event);
    }
    if (res.status === 403 && event.attendees?.length) {
      const { attendees, ...withoutAttendees } = event;
      void attendees;
      res = await this.call(eventId ? "PUT" : "POST", path, withoutAttendees);
    }
    if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  async delete(calendarId: string, eventId: string, opts: { sendUpdates?: boolean } = {}): Promise<void> {
    const res = await this.call("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}${opts.sendUpdates ? "?sendUpdates=all" : ""}`);
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar delete ${res.status}`);
  }
}

export type GooglePerson = { email: string; name: string | null };

type PeopleResponse = { results?: { person?: Person }[]; people?: Person[] };
type Person = { names?: { displayName?: string }[]; emailAddresses?: { value?: string }[] };

/** Every address in a People API search answer (contacts and other contacts use `results`, the directory `people`). */
export function peopleFromResponse(json: PeopleResponse): GooglePerson[] {
  const people = [...(json.results ?? []).map((r) => r.person), ...(json.people ?? [])].filter((p): p is Person => Boolean(p));
  return people.flatMap((p) => (p.emailAddresses ?? []).filter((e) => e.value).map((e) => ({ email: e.value!.trim().toLowerCase(), name: p.names?.[0]?.displayName ?? null })));
}

/** Acting users whose contact searches have been warmed up (Google asks for one empty search first). */
const warmed = new Set<string>();

/**
 * Search as `subject` the way Google Calendar suggests guests: their own
 * contacts, their "other contacts" (people they have emailed) and the
 * Workspace directory. Contacts first, one entry per address. A source
 * that fails is left out; a refused delegation throws.
 */
export async function searchGooglePeople(account: ServiceAccount, subject: string, query: string, fetchImpl: typeof fetch = fetch): Promise<GooglePerson[]> {
  const token = await accessToken(account, fetchImpl, subject, PEOPLE_SCOPES.join(" "));
  const search = async (path: string, q: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ query: q, readMask: "names,emailAddresses", pageSize: "10", ...extra });
    const res = await fetchImpl(`https://people.googleapis.com/v1/${path}?${params}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5_000) });
    if (!res.ok) throw new Error(`People API ${path} ${res.status}`);
    return peopleFromResponse((await res.json()) as PeopleResponse);
  };
  if (!warmed.has(subject)) {
    warmed.add(subject);
    await Promise.allSettled([search("people:searchContacts", ""), search("otherContacts:search", "")]);
  }
  const found = await Promise.allSettled([
    search("people:searchContacts", query),
    search("otherContacts:search", query),
    search("people:searchDirectoryPeople", query, { sources: "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE" }),
  ]);
  const byEmail = new Map<string, GooglePerson>();
  for (const r of found) if (r.status === "fulfilled") for (const p of r.value) if (!byEmail.has(p.email)) byEmail.set(p.email, p);
  return [...byEmail.values()];
}
