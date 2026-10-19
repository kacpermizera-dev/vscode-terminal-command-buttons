export type ShellKind = "posix" | "fish" | "pwsh" | "cmd" | "unknown";

const POSIX_SHELLS = ["bash", "sh", "zsh", "ksh", "dash", "gitbash", "wsl"];

export function shellKindOf(shell: string | undefined, shellPath?: string): ShellKind {
  const name = (shell ?? shellPath?.split(/[\\/]/).pop() ?? "")
    .toLowerCase()
    .replace(/\.exe$/, "");
  if (POSIX_SHELLS.includes(name)) {
    return "posix";
  }
  if (name === "pwsh" || name === "powershell") {
    return "pwsh";
  }
  if (name === "cmd" || name === "fish") {
    return name;
  }
  return "unknown";
}

const SAFE: Record<ShellKind, RegExp> = {
  posix: /^[A-Za-z0-9_@%+=:,./-]+$/,
  fish: /^[A-Za-z0-9_@+=:,./-]+$/,
  pwsh: /^[A-Za-z0-9_.:\\/+=-]+$/,
  cmd: /^[A-Za-z0-9_.:\\/+-]+$/,
  unknown: /^[A-Za-z0-9_+=:,./-]+$/,
};

const PWSH_SINGLE = "'‘’‚‛";
const PWSH_DOUBLE = '"“”„';

type QuoteContext = "none" | "single" | "double" | "unsafe";

type Frame = "none" | "sub" | "single" | "double" | "ansi" | "backtick" | "param";

function scanPosix(template: string, offset: number, fish: boolean): Frame[] {
  const stack: Frame[] = ["none"];
  for (let i = 0; i < offset; i++) {
    const c = template[i];
    const next = template[i + 1];
    const top = stack[stack.length - 1];
    switch (top) {
      case "single":
        if (fish && c === "\\") {
          i++;
        } else if (c === "'") {
          stack.pop();
        }
        break;
      case "ansi":
        if (c === "\\") {
          i++;
        } else if (c === "'") {
          stack.pop();
        }
        break;
      case "param":
        if (c === "}") {
          stack.pop();
        }
        break;
      case "double":
        if (c === "\\") {
          i++;
        } else if (c === '"') {
          stack.pop();
        } else if (c === "$" && next === "(") {
          stack.push("sub");
          i++;
        } else if (c === "$" && next === "{") {
          stack.push("param");
          i++;
        } else if (c === "`" && !fish) {
          stack.push("backtick");
        }
        break;
      default:
        if (c === "\\") {
          i++;
        } else if (c === "'") {
          stack.push("single");
        } else if (c === '"') {
          stack.push("double");
        } else if (c === "$" && next === "'" && !fish) {
          stack.push("ansi");
          i++;
        } else if (c === "$" && next === "(") {
          stack.push("sub");
          i++;
        } else if (c === "$" && next === "{") {
          stack.push("param");
          i++;
        } else if (c === "(" && fish) {
          stack.push("sub");
        } else if (c === ")" && top === "sub") {
          stack.pop();
        } else if (c === "`" && !fish) {
          if (top === "backtick") {
            stack.pop();
          } else {
            stack.push("backtick");
          }
        }
    }
  }
  return stack;
}

function scanPwsh(template: string, offset: number): Frame[] {
  const stack: Frame[] = ["none"];
  for (let i = 0; i < offset; i++) {
    const c = template[i];
    const top = stack[stack.length - 1];
    if (top === "single" || top === "double") {
      const quotes = top === "single" ? PWSH_SINGLE : PWSH_DOUBLE;
      if (top === "double" && c === "`") {
        i++;
      } else if (quotes.includes(c)) {
        if (i + 1 < offset && quotes.includes(template[i + 1])) {
          i++;
        } else {
          stack.pop();
        }
      } else if (top === "double" && c === "$" && template[i + 1] === "(") {
        stack.push("sub");
        i++;
      }
    } else if (c === "`") {
      i++;
    } else if (PWSH_SINGLE.includes(c)) {
      stack.push("single");
    } else if (PWSH_DOUBLE.includes(c)) {
      stack.push("double");
    } else if (c === "(") {
      stack.push("sub");
    } else if (c === ")" && top === "sub") {
      stack.pop();
    }
  }
  return stack;
}

function scanCmd(template: string, offset: number): Frame[] {
  let double = false;
  for (let i = 0; i < offset; i++) {
    if (!double && template[i] === "^") {
      i++;
    } else if (template[i] === '"') {
      double = !double;
    }
  }
  return [double ? "double" : "none"];
}

function contextAt(template: string, offset: number, kind: ShellKind): QuoteContext {
  if (kind === "unknown") {
    return "unsafe";
  }
  const stack =
    kind === "pwsh"
      ? scanPwsh(template, offset)
      : kind === "cmd"
        ? scanCmd(template, offset)
        : scanPosix(template, offset, kind === "fish");
  const top = stack[stack.length - 1];
  if (stack.some((frame) => frame === "backtick" || frame === "ansi" || frame === "param")) {
    return "unsafe";
  }
  if (kind === "pwsh" && stack.filter((f) => f === "single" || f === "double").length > 1) {
    return "unsafe";
  }
  return top === "single" || top === "double" ? top : "none";
}

function quoteValue(value: string, kind: ShellKind, context: QuoteContext): string | undefined {
  const safe = SAFE[kind].test(value);
  if (context === "unsafe") {
    return SAFE.unknown.test(value) ? value : undefined;
  }
  switch (kind) {
    case "posix": {
      const single = value.replace(/'/g, "'\\''");
      if (context === "single") {
        return single;
      }
      if (safe) {
        return value;
      }
      return context === "double" ? `"'${single}'"` : `'${single}'`;
    }
    case "fish": {
      if (context === "single") {
        return value.replace(/[\\']/g, "\\$&");
      }
      if (context === "double") {
        return value.replace(/[\\"$]/g, "\\$&");
      }
      return safe ? value : `'${value.replace(/[\\']/g, "\\$&")}'`;
    }
    case "pwsh": {
      const single = value.replace(/['‘’‚‛]/g, "$&$&");
      if (context === "single") {
        return single;
      }
      if (context === "double") {
        return value.replace(/[`$"“”„]/g, "`$&");
      }
      return safe ? value : `'${single}'`;
    }
    case "cmd":
      if (/["%\r\n]/.test(value)) {
        return undefined;
      }
      return context === "double" || safe ? value : `"${value}"`;
    case "unknown":
      return safe ? value : undefined;
  }
}

export function quoteForShell(
  template: string,
  offset: number,
  value: string,
  kind: ShellKind
): string | undefined {
  const context = contextAt(template, offset, kind);
  if (value === "" && context === "none") {
    return kind === "cmd" ? '""' : "''";
  }
  return quoteValue(value, kind, context);
}
