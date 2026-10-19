// Podział przycisków na sekcje widoku. Bez importu vscode, żeby dało się testować.

interface Sectionable {
  group?: string;
  scope: "global" | "workspace";
}

export interface Arranged<T> {
  button: T;
  // Klucz sekcji "<zakres>|<grupa>" - przeciąganie tylko w jej obrębie
  section: string;
  scopeLabel: string;
  // Pusta = przycisk bez grupy, na górze swojego zakresu
  group: string;
}

const SCOPES: Sectionable["scope"][] = ["workspace", "global"];

export function scopeLabel(scope: Sectionable["scope"]): string {
  return scope === "workspace" ? "This workspace" : "All workspaces";
}

// Najpierw zakres (workspace, potem globalne), w nim przyciski bez grupy,
// a potem grupy w kolejności pierwszego wystąpienia. Dopisanie grupy niczego nie przestawia
// poza tym, że jej przyciski przechodzą do podsekcji w swoim zakresie.
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
