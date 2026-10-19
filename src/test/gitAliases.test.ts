import * as assert from "assert";
import {
  findAliasForCommand,
  isValidAliasName,
  parseGitAliases,
} from "../gitAliases";

function entry(scope: string, origin: string, key: string, value: string) {
  return `${scope}\0${origin}\0${key}\n${value}\0`;
}

const GLOBAL = "file:C:/Users/me/.gitconfig";
const LOCAL = "file:.git/config";

suite("Git aliases", () => {
  test("parses scope, file and value, sorted by name", () => {
    const output =
      entry("global", GLOBAL, "alias.st", "status -sb") +
      entry("local", LOCAL, "alias.lg", "log --oneline --graph");
    assert.deepStrictEqual(parseGitAliases(output), [
      {
        name: "lg",
        expansion: "log --oneline --graph",
        shell: false,
        scope: "local",
        file: ".git/config",
      },
      {
        name: "st",
        expansion: "status -sb",
        shell: false,
        scope: "global",
        file: "C:/Users/me/.gitconfig",
      },
    ]);
  });

  test("marks shell aliases, no file for command line config", () => {
    const output = entry("command", "command line:", "alias.up", "!git fetch && git rebase");
    assert.deepStrictEqual(parseGitAliases(output), [
      { name: "up", expansion: "!git fetch && git rebase", shell: true, scope: "command" },
    ]);
  });

  test("later entry wins, like local config over global", () => {
    const output =
      entry("global", GLOBAL, "alias.co", "checkout") +
      entry("local", LOCAL, "alias.co", "switch");
    const [alias] = parseGitAliases(output);
    assert.strictEqual(alias.expansion, "switch");
    assert.strictEqual(alias.scope, "local");
  });

  test("skips entries without a value and other keys", () => {
    const output =
      "global\0" + GLOBAL + "\0alias.empty\0" + entry("global", GLOBAL, "user.name", "Kacper");
    assert.deepStrictEqual(parseGitAliases(output), []);
    assert.deepStrictEqual(parseGitAliases(""), []);
  });

  test("validates alias names", () => {
    assert.ok(isValidAliasName("lg"));
    assert.ok(isValidAliasName("stash-untracked"));
    assert.ok(!isValidAliasName("1st"));
    assert.ok(!isValidAliasName("my alias"));
    assert.ok(!isValidAliasName("a.b"));
  });

  test("finds the alias a button command calls", () => {
    const aliases = parseGitAliases(
      entry("global", GLOBAL, "alias.lg", "log --oneline") +
        entry("global", GLOBAL, "alias.st", "status")
    );
    assert.strictEqual(findAliasForCommand("git lg -5", aliases)?.name, "lg");
    assert.strictEqual(findAliasForCommand("  git ST", aliases)?.name, "st");
    assert.strictEqual(findAliasForCommand("git status", aliases), undefined);
    assert.strictEqual(findAliasForCommand("git --no-pager lg", aliases), undefined);
    assert.strictEqual(findAliasForCommand("npm run lg", aliases), undefined);
  });
});
