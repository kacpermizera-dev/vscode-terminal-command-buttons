export interface ButtonInput {
  id: string;
  type?: "promptString" | "pickString";
  description?: string;
  default?: string;
  options?: string[];
  optionsFrom?: string;
  password?: boolean;
}

export function parseOptionLines(output: string): string[] {
  const options = new Set<string>();
  for (const line of output.split(/\r?\n/)) {
    const option = line.replace(/^\*\s+/, "").trim();
    if (option) {
      options.add(option);
    }
  }
  return [...options];
}

const BUILTIN_NAMES = [
  "workspaceFolder",
  "workspaceFolderBasename",
  "file",
  "fileBasename",
  "fileBasenameNoExtension",
  "fileExtname",
  "fileDirname",
  "relativeFile",
  "selectedText",
  "lineNumber",
];

const VARIABLE_PATTERN = new RegExp(
  "\\$\\{(input:[\\w-]+|env:[A-Za-z_][A-Za-z0-9_]*|" + BUILTIN_NAMES.join("|") + ")\\}",
  "g"
);

const INPUT_ID_PATTERN = /^[\w-]+$/;

export function listVariables(command: string): string[] {
  const names: string[] = [];
  for (const match of command.matchAll(VARIABLE_PATTERN)) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

export function substitute(
  command: string,
  values: Record<string, string>,
  quote: (name: string, value: string, offset: number) => string = (_name, value) => value
): string {
  return command.replace(VARIABLE_PATTERN, (whole, name: string, offset: number) =>
    Object.prototype.hasOwnProperty.call(values, name)
      ? quote(name, values[name], offset)
      : whole
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function sanitizeInputs(value: unknown): ButtonInput[] | undefined {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    return undefined;
  }
  const inputs: ButtonInput[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      return undefined;
    }
    const raw = item as Record<string, unknown>;
    if (typeof raw.id !== "string" || !INPUT_ID_PATTERN.test(raw.id)) {
      return undefined;
    }
    if (raw.type !== undefined && raw.type !== "promptString" && raw.type !== "pickString") {
      return undefined;
    }
    if (
      raw.options !== undefined &&
      !(Array.isArray(raw.options) && raw.options.every((o) => typeof o === "string"))
    ) {
      return undefined;
    }
    const description = optionalString(raw.description);
    const defaultValue = optionalString(raw.default);
    const optionsFrom = optionalString(raw.optionsFrom)?.trim();
    inputs.push({
      id: raw.id,
      ...(raw.type ? { type: raw.type } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(defaultValue !== undefined ? { default: defaultValue } : {}),
      ...(raw.options ? { options: raw.options as string[] } : {}),
      ...(optionsFrom ? { optionsFrom } : {}),
      ...(raw.password === true ? { password: true } : {}),
    });
  }
  return inputs;
}
