// Zmienne w komendach przycisków. Bez importu vscode, żeby dało się testować.

// Definicja pytania dla ${input:id}, jak "inputs" w tasks.json
export interface ButtonInput {
  id: string;
  type?: "promptString" | "pickString";
  description?: string;
  default?: string;
  options?: string[];
  // Komenda shella, której wynik (linia = opcja) daje listę dla pickString
  optionsFrom?: string;
  // Wartość ukryta przy wpisywaniu i niezapamiętywana
  password?: boolean;
}

// Opcje z wyniku komendy: niepuste linie, bez powtórzeń, bez znacznika "* " (np. git branch)
export function parseOptionLines(output: string): string[] {
  const options: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    const option = line.replace(/^\*\s+/, "").trim();
    if (option && !options.includes(option)) {
      options.push(option);
    }
  }
  return options;
}

// Tylko znane nazwy - ${HOME} czy ${PATH} w bashu zostają nietknięte
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

// Nazwy zmiennych w kolejności pierwszego wystąpienia, bez powtórzeń
export function listVariables(command: string): string[] {
  const names: string[] = [];
  for (const match of command.matchAll(VARIABLE_PATTERN)) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
  }
  return names;
}

// Podstawienie wartości; zmienne bez wartości zostają w tekście
export function substitute(command: string, values: Record<string, string>): string {
  return command.replace(VARIABLE_PATTERN, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : whole
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Walidacja "inputs" z ustawień lub formularza; undefined = niepoprawna struktura
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
