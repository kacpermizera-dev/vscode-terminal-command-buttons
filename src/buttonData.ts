import type { CommandButton } from "./buttons";
import { ButtonInput, sanitizeInputs } from "./variables";

export const DEFAULT_COLOR = "#3794ff";

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export interface NormalizedButtons {
  buttons: CommandButton[];
  invalid: unknown[];
}

function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function normalizeInputs(value: unknown): { inputs: ButtonInput[]; raw?: unknown } {
  if (value === undefined || value === null) {
    return { inputs: [] };
  }
  if (!Array.isArray(value)) {
    return { inputs: [], raw: value };
  }
  const inputs: ButtonInput[] = [];
  let broken = false;
  for (const item of value) {
    const one = sanitizeInputs([item]);
    if (one) {
      inputs.push(...one);
    } else {
      broken = true;
    }
  }
  return broken ? { inputs, raw: value } : { inputs };
}

export function normalizeButtons(
  value: unknown,
  idPrefix: string,
  ids: Set<string> = new Set()
): NormalizedButtons {
  const buttons: CommandButton[] = [];
  const invalid: unknown[] = [];
  if (!Array.isArray(value)) {
    return { buttons, invalid };
  }
  value.forEach((item) => {
    const raw =
      typeof item === "object" && item !== null && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : undefined;
    const name = text(raw?.name);
    const command = text(raw?.command);
    if (!raw || !name || !command) {
      invalid.push(item);
      return;
    }

    let id = text(raw.id);
    if (!id || ids.has(id)) {
      const base = `${idPrefix}-${hash(`${name}\n${command}`)}`;
      id = base;
      for (let n = 2; ids.has(id); n++) {
        id = `${base}-${n}`;
      }
    }
    ids.add(id);

    const icon = text(raw.icon);
    const terminal = text(raw.terminal);
    const group = text(raw.group);
    const { inputs, raw: rawInputs } = normalizeInputs(raw.inputs);
    buttons.push({
      id,
      name,
      command,
      color: text(raw.color) ?? DEFAULT_COLOR,
      ...(icon ? { icon } : {}),
      ...(terminal ? { terminal } : {}),
      ...(inputs.length > 0 ? { inputs } : {}),
      ...(rawInputs !== undefined ? { rawInputs } : {}),
      ...(group ? { group } : {}),
      ...(raw.confirm === true ? { confirm: true } : {}),
      ...(raw.pinned === true ? { pinned: true } : {}),
    });
  });
  return { buttons, invalid };
}

export function reorderStore(
  buttons: CommandButton[],
  ids: string[]
): CommandButton[] | undefined {
  const wanted = new Set(ids);
  if (!buttons.some((b) => wanted.has(b.id))) {
    return undefined;
  }
  const byId = new Map(buttons.map((b) => [b.id, b]));
  const ordered = [...wanted]
    .map((id) => byId.get(id))
    .filter((b): b is CommandButton => b !== undefined);
  const next = [...ordered, ...buttons.filter((b) => !wanted.has(b.id))];
  return next.every((b, i) => b === buttons[i]) ? undefined : next;
}
