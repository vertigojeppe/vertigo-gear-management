import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PEOPLE_SCOPES, peopleFromResponse, searchGooglePeople } from "../google";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const account = { client_email: "sa@example.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

/** A fake Google: the token endpoint, then a canned answer per People API path; records every call. */
function fakeGoogle(answers: Record<string, unknown>, failing: string[] = []) {
  const calls: string[] = [];
  let tokenScope = "";
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.host === "oauth2.googleapis.com") {
      const jwt = new URLSearchParams(String(init?.body)).get("assertion")!;
      tokenScope = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).scope;
      return Response.json({ access_token: "t", expires_in: 3600 });
    }
    const path = url.pathname.replace("/v1/", "");
    calls.push(`${path}?${url.searchParams.get("query")}`);
    if (failing.includes(path)) return new Response("no", { status: 403 });
    return Response.json(answers[path] ?? {});
  }) as typeof fetch;
  return { fetchImpl, calls, scope: () => tokenScope };
}

const person = (name: string, ...emails: string[]) => ({ names: [{ displayName: name }], emailAddresses: emails.map((value) => ({ value })) });

describe("Google guest suggestions", () => {
  it("reads every address of every person in an answer", () => {
    expect(peopleFromResponse({ results: [{ person: person("Anna Holm", "Anna@Venue.dk", "anna@home.dk") }, {}] })).toEqual([
      { email: "anna@venue.dk", name: "Anna Holm" },
      { email: "anna@home.dk", name: "Anna Holm" },
    ]);
    expect(peopleFromResponse({ people: [{ emailAddresses: [{ value: "x@y.dk" }] }] })).toEqual([{ email: "x@y.dk", name: null }]);
  });

  it("searches contacts, other contacts and the directory as the person, contacts first, skipping a source that fails", async () => {
    const google = fakeGoogle(
      {
        "people:searchContacts": { results: [{ person: person("Anna Holm", "anna@venue.dk") }] },
        "otherContacts:search": { results: [{ person: person("Anna (mail)", "anna@venue.dk") }, { person: person("Bo", "bo@crew.dk") }] },
      },
      ["people:searchDirectoryPeople"],
    );
    const found = await searchGooglePeople(account, `first-${Date.now()}@vertigo.test`, "an", google.fetchImpl);
    expect(found).toEqual([
      { email: "anna@venue.dk", name: "Anna Holm" },
      { email: "bo@crew.dk", name: "Bo" },
    ]);
    expect(google.scope().split(" ")).toEqual(PEOPLE_SCOPES);
    // The first search for a person warms the contact caches with empty queries.
    expect(google.calls.slice(0, 2).sort()).toEqual(["otherContacts:search?", "people:searchContacts?"]);
    expect(google.calls.slice(2).sort()).toEqual(["otherContacts:search?an", "people:searchContacts?an", "people:searchDirectoryPeople?an"]);
  });
});
