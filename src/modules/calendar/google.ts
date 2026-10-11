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
 */
type ServiceAccount = { client_email: string; private_key: string };

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

export function isGoogleConfigured(): boolean {
  return googleConfig() !== null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function accessToken(account: ServiceAccount, fetchImpl: typeof fetch): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/calendar.events",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Google token request failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export class GoogleCalendar {
  constructor(
    private readonly account: ServiceAccount,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await accessToken(this.account, this.fetchImpl);
    return this.fetchImpl(`https://www.googleapis.com/calendar/v3${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  }

  /** Create or update; returns the event id. Retries without attendees if the account may not invite. */
  async upsert(calendarId: string, eventId: string | null, event: GoogleEvent): Promise<string> {
    const path = `/calendars/${encodeURIComponent(calendarId)}/events${eventId ? `/${encodeURIComponent(eventId)}` : ""}`;
    let res = await this.call(eventId ? "PUT" : "POST", path, event);
    if (res.status === 404 && eventId) {
      res = await this.call("POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
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

  async delete(calendarId: string, eventId: string): Promise<void> {
    const res = await this.call("DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`);
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`Google Calendar delete ${res.status}`);
  }
}
