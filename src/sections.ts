interface Sectionable {
  group?: string;
  scope: "global" | "workspace";
}

export interface Arranged<T> {
  button: T;
  section: string;
  scopeLabel: string;
  group: string;
}

const SCOPES: Sectionable["scope"][] = ["workspace", "global"];

export function scopeLabel(scope: Sectionable["scope"]): string {
  return scope === "workspace" ? "This workspace" : "All workspaces";
}

export function arrangeButtons<T extends Sectionable>(buttons: T[]): Arranged<T>[] {
  return SCOPES.flatMap((scope) => {
    const inScope = buttons.filter((b) => b.scope === scope);
    const groups: string[] = [""];
    inScope.forEach((b) => {
      if (b.group && !groups.includes(b.group)) {
        groups.push(b.group);
      }
    });
    return groups.flatMap((group) =>
      inScope
        .filter((b) => (b.group || "") === group)
        .map((button) => ({
          button,
          section: scope + "|" + group,
          scopeLabel: scopeLabel(scope),
          group,
        }))
    );
  });
}
