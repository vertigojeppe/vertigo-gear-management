import { CF_PREFIX, formatCustomFieldValue, type CustomFieldDef, type CustomFieldValues } from "@/lib/custom-fields";
import { Input } from "@/components/ui/input";
import { DecimalInput } from "./decimal-input";
import { Field } from "./field";
import { NativeSelect } from "./native-select";

/**
 * Renders inputs for admin-defined custom fields. Inputs are named
 * `cf.<key>` so server actions can pick them out with customFieldsFromForm.
 */
export function CustomFieldInputs({
  defs,
  values,
  echoed,
  errors,
  title,
}: {
  defs: CustomFieldDef[];
  values?: CustomFieldValues;
  echoed?: Record<string, string>;
  errors?: Record<string, string>;
  title?: string;
}) {
  if (defs.length === 0) return null;
  const current = (key: string): string => {
    const name = CF_PREFIX + key;
    if (echoed && name in echoed) return echoed[name];
    const v = values?.[key];
    return v === null || v === undefined ? "" : String(v);
  };
  return (
    <fieldset className="flex flex-col gap-4">
      {title && <legend className="mb-2 text-sm font-medium">{title}</legend>}
      {defs.map((def) => {
        const name = CF_PREFIX + def.key;
        const id = `cf-${def.key}`;
        const error = errors?.[name];
        if (def.type === "checkbox") {
          const checked = echoed ? echoed[name] === "on" : Boolean(values?.[def.key]);
          return (
            <label key={def.key} htmlFor={id} className="flex items-center gap-2 text-sm">
              <input id={id} name={name} type="checkbox" defaultChecked={checked} className="size-4" />
              {def.label}
            </label>
          );
        }
        return (
          <Field key={def.key} id={id} label={def.label} error={error} optional={!def.required}>
            {def.type === "select" ? (
              <NativeSelect id={id} name={name} defaultValue={current(def.key)} required={def.required}>
                <option value="">—</option>
                {def.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </NativeSelect>
            ) : def.type === "number" ? (
              <DecimalInput id={id} name={name} defaultValue={current(def.key)} required={def.required} aria-invalid={error ? true : undefined} />
            ) : (
              <Input
                id={id}
                name={name}
                type={def.type === "date" ? "date" : def.type === "url" ? "url" : "text"}
                defaultValue={current(def.key)}
                required={def.required}
                aria-invalid={error ? true : undefined}
              />
            )}
          </Field>
        );
      })}
    </fieldset>
  );
}

/** Read-only list of custom field values. */
export function CustomFieldValuesList({ defs, values }: { defs: CustomFieldDef[]; values: CustomFieldValues }) {
  const rows = defs.map((d) => ({ def: d, text: formatCustomFieldValue(d, values[d.key]) })).filter((r) => r.text !== "");
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
      {rows.map(({ def, text }) => (
        <div key={def.key} className="contents">
          <dt className="text-muted-foreground">{def.label}</dt>
          <dd>
            {def.type === "url" ? (
              <a href={text} className="underline" target="_blank" rel="noreferrer">
                {text}
              </a>
            ) : (
              text
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
