import * as assert from "assert";
import { arrangeButtons } from "../sections";

type Scope = "global" | "workspace";

function b(name: string, scope: Scope, group?: string) {
  return { name, scope, ...(group ? { group } : {}) };
}

function layout(buttons: ReturnType<typeof b>[]) {
  return arrangeButtons(buttons).map((a) =>
    [a.scopeLabel, a.group, a.button.name].filter(Boolean).join(" / ")
  );
}

suite("Sections", () => {
  test("without groups, workspace buttons come first", () => {
    assert.deepStrictEqual(
      layout([b("pull", "global"), b("dev", "workspace"), b("push", "global")]),
      ["This workspace / dev", "All workspaces / pull", "All workspaces / push"]
    );
  });

  test("groups stay inside their scope, ungrouped buttons first", () => {
    assert.deepStrictEqual(
      layout([
        b("ls", "global"),
        b("pull", "global", "Git"),
        b("build", "workspace", "Build"),
        b("push", "global", "Git"),
        b("dev", "workspace"),
        b("lint", "workspace", "Git"),
      ]),
      [
        "This workspace / dev",
        "This workspace / Build / build",
        "This workspace / Git / lint",
        "All workspaces / ls",
        "All workspaces / Git / pull",
        "All workspaces / Git / push",
      ]
    );
  });

  test("adding a group does not move the other buttons", () => {
    const before = layout([b("a", "global"), b("b", "global"), b("c", "workspace")]);
    const after = layout([b("a", "global"), b("b", "global", "Test"), b("c", "workspace")]);
    assert.deepStrictEqual(before, ["This workspace / c", "All workspaces / a", "All workspaces / b"]);
    assert.deepStrictEqual(after, ["This workspace / c", "All workspaces / a", "All workspaces / Test / b"]);
  });

  test("section key is scope and group", () => {
    const [grouped] = arrangeButtons([b("pull", "global", "Git")]);
    const [plain] = arrangeButtons([b("pull", "workspace")]);
    assert.strictEqual(grouped.section, "global|Git");
    assert.strictEqual(plain.section, "workspace|");
  });
});
