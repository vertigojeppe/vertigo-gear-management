"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { googleGuestSuggestions, guestSuggestions } from "../actions";
import { completeGuest, matchGuests, typedGuest, type GuestChoice } from "../logic";

/**
 * The Guests field: addresses separated by commas, with suggestions for the
 * one being typed from the contact library and earlier guests (fetched the
 * first time the field gets focus), then from the person's Google contacts,
 * mailbox and directory (asked after a pause in typing, from three letters).
 */
export function GuestsInput({ id, name, defaultValue, placeholder }: { id: string; name: string; defaultValue: string; placeholder?: string }) {
  const listId = useId();
  const [text, setText] = useState(defaultValue);
  const [choices, setChoices] = useState<GuestChoice[] | null>(null);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [google, setGoogle] = useState<{ q: string; list: GuestChoice[] }>({ q: "", list: [] });
  const typed = typedGuest(text).trim();
  useEffect(() => {
    if (!open || typed.length < 3) return;
    const timer = setTimeout(() => googleGuestSuggestions(typed).then((list) => setGoogle({ q: typed, list }), () => undefined), 300);
    return () => clearTimeout(timer);
  }, [open, typed]);
  // The app's own suggestions first, then Google's for what is typed now (an answer for older letters is ignored).
  const local = choices ?? [];
  const known = new Set(local.map((c) => c.email));
  const all = google.q === typed ? [...local, ...google.list.filter((g) => !known.has(g.email))] : local;
  const matches = open ? matchGuests(all, text) : [];
  const pick = (email: string) => {
    setText(completeGuest(text, email));
    setActive(0);
  };
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={matches.length > 0}
        aria-controls={listId}
        aria-activedescendant={matches.length > 0 ? `${listId}-${active}` : undefined}
        onFocus={() => {
          setOpen(true);
          if (choices === null) guestSuggestions().then(setChoices, () => setChoices([]));
        }}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (matches.length === 0) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            pick(matches[Math.min(active, matches.length - 1)].email);
          } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
          }
        }}
      />
      {matches.length > 0 && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {matches.map((m, i) => (
            <li
              key={m.email}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer rounded px-2 py-1 ${i === active ? "bg-muted" : ""}`}
              // mousedown, not click: keeps the focus in the field, which blur would otherwise close the list on.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m.email);
              }}
            >
              {m.name ? (
                <>
                  {m.name} <span className="text-muted-foreground">{m.email}</span>
                </>
              ) : (
                m.email
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
