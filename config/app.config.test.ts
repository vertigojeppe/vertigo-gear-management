import { describe, expect, it } from "vitest";
import {
  ITEM_STATUSES,
  LABEL_SIZES,
  PERMISSIONS,
  PROJECT_PHASES,
  PROJECT_STATUSES,
  RENTAL_STATUSES,
  ROLES,
  appConfig,
} from "./app.config";

function keysOf(list: readonly { key: string }[]) {
  return list.map((s) => s.key);
}

describe("app.config", () => {
  it("has unique status, phase and label keys", () => {
    for (const list of [ITEM_STATUSES, PROJECT_STATUSES, PROJECT_PHASES, RENTAL_STATUSES, LABEL_SIZES]) {
      const keys = keysOf(list);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it("only grants known permissions", () => {
    for (const role of Object.values(ROLES)) {
      for (const p of role.permissions) {
        expect(PERMISSIONS).toContain(p);
      }
    }
  });

  it("uses Europe/Copenhagen and DKK", () => {
    expect(appConfig.timezone).toBe("Europe/Copenhagen");
    expect(appConfig.currency).toBe("DKK");
  });
});
