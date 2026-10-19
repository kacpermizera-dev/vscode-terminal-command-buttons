import * as assert from "assert";
import { normalizeButtons, reorderStore } from "../buttonData";

suite("Button data", () => {
  test("keeps valid buttons and fills in defaults", () => {
    const { buttons, invalid } = normalizeButtons(
      [
        { id: "a", name: " Build ", command: "npm run build", pinned: true, extra: 1 },
        { name: "Test", command: "npm test", confirm: "yes" },
      ],
      "global"
    );
    assert.deepStrictEqual(buttons[0], {
      id: "a",
      name: "Build",
      command: "npm run build",
      color: "#3794ff",
      pinned: true,
    });
    assert.match(buttons[1].id, /^global-[0-9a-f]{8}$/);
    assert.deepStrictEqual(invalid, []);
  });

  test("generated ids follow the button, not its position", () => {
    const test = { name: "Test", command: "npm test" };
    const before = normalizeButtons([test], "global").buttons[0].id;
    const after = normalizeButtons([{ name: "New", command: "ls" }, test], "global").buttons[1].id;
    assert.strictEqual(after, before);
  });

  test("ids are unique, also across stores", () => {
    const ids = new Set<string>();
    const legacy = normalizeButtons(
      [
        { id: "x", name: "One", command: "a" },
        { id: "x", name: "Two", command: "b" },
      ],
      "legacy",
      ids
    );
    const global = normalizeButtons([{ id: "x", name: "Three", command: "c" }], "global", ids);
    const all = [...legacy.buttons, ...global.buttons].map((b) => b.id);
    assert.strictEqual(all[0], "x");
    assert.strictEqual(new Set(all).size, 3);
  });

  test("keeps good questions and the original of broken ones", () => {
    const inputs = [{ id: "branch", type: "pickString", optionsFrom: "git branch" }, { id: "bad id" }];
    const [button] = normalizeButtons(
      [{ id: "a", name: "A", command: "git checkout ${input:branch}", inputs }],
      "global"
    ).buttons;
    assert.deepStrictEqual(button.inputs, [
      { id: "branch", type: "pickString", optionsFrom: "git branch" },
    ]);
    assert.strictEqual(button.rawInputs, inputs);
  });

  test("sets aside entries without a name or command", () => {
    const { buttons, invalid } = normalizeButtons(
      [{ name: "No command" }, { command: 123, name: "x" }, "text", null],
      "global"
    );
    assert.deepStrictEqual(buttons, []);
    assert.strictEqual(invalid.length, 4);
    assert.deepStrictEqual(normalizeButtons(undefined, "global"), { buttons: [], invalid: [] });
  });

  test("reorders only when the order changes", () => {
    const a = { id: "a", name: "A", command: "a", color: "" };
    const b = { id: "b", name: "B", command: "b", color: "" };
    const c = { id: "c", name: "C", command: "c", color: "" };
    assert.strictEqual(reorderStore([a, b], ["a", "b", "z"]), undefined);
    assert.strictEqual(reorderStore([a, b], ["y", "z"]), undefined);
    assert.deepStrictEqual(reorderStore([a, b, c], ["b", "a"]), [b, a, c]);
  });
});
