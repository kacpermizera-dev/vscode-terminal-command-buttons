import * as assert from "assert";
import {
  listVariables,
  parseOptionLines,
  sanitizeInputs,
  substitute,
} from "../variables";

suite("Variables", () => {
  test("lists known variables once, in order", () => {
    assert.deepStrictEqual(
      listVariables('git commit -m "${input:msg}" && echo ${input:msg} ${file} ${env:HOME}'),
      ["input:msg", "file", "env:HOME"]
    );
  });

  test("leaves shell variables alone", () => {
    const command = "echo ${HOME} $PATH ${input:x}";
    assert.deepStrictEqual(listVariables(command), ["input:x"]);
    assert.strictEqual(substitute(command, { "input:x": "1" }), "echo ${HOME} $PATH 1");
  });

  test("substitutes every occurrence, keeps values without a match", () => {
    assert.strictEqual(
      substitute("${input:a}-${input:a}-${input:b}", { "input:a": "x" }),
      "x-x-${input:b}"
    );
    assert.strictEqual(substitute("${input:a}", { "input:a": "$&$1" }), "$&$1");
  });

  test("accepts valid inputs and drops unknown fields", () => {
    assert.deepStrictEqual(
      sanitizeInputs([
        { id: "branch", type: "pickString", options: ["main", "dev"], default: "dev", extra: 1 },
        { id: "token", password: true },
      ]),
      [
        { id: "branch", type: "pickString", default: "dev", options: ["main", "dev"] },
        { id: "token", password: true },
      ]
    );
    assert.deepStrictEqual(sanitizeInputs(undefined), []);
  });

  test("keeps a command for list options", () => {
    assert.deepStrictEqual(
      sanitizeInputs([{ id: "b", type: "pickString", optionsFrom: "  git branch  " }]),
      [{ id: "b", type: "pickString", optionsFrom: "git branch" }]
    );
  });

  test("turns command output into options", () => {
    assert.deepStrictEqual(
      parseOptionLines("  develop\r\n* main\r\n  feature/x\r\n\r\n  main\r\n"),
      ["develop", "main", "feature/x"]
    );
    assert.deepStrictEqual(parseOptionLines(""), []);
  });

  test("rejects malformed inputs", () => {
    assert.strictEqual(sanitizeInputs({ id: "x" }), undefined);
    assert.strictEqual(sanitizeInputs([{ id: "bad id" }]), undefined);
    assert.strictEqual(sanitizeInputs([{ id: "x", type: "command" }]), undefined);
    assert.strictEqual(sanitizeInputs([{ id: "x", options: [1] }]), undefined);
    assert.strictEqual(sanitizeInputs(["x"]), undefined);
  });
});
