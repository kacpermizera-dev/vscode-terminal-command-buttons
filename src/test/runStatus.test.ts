import * as assert from "assert";
import {
  formatAgo,
  formatDuration,
  formatStatus,
  isSameCommand,
} from "../runStatus";

suite("Run status", () => {
  test("matches the command line from shell integration", () => {
    // Spacja z obejścia Git Bash i zbłąkany ESC przed komendą
    assert.ok(isSameCommand(" git status", "git status"));
    assert.ok(isSameCommand("\u001b git  status ", "git status"));
    assert.ok(!isSameCommand("git status -sb", "git status"));
  });

  test("formats durations", () => {
    assert.strictEqual(formatDuration(420), "0.4s");
    assert.strictEqual(formatDuration(12_300), "12s");
    assert.strictEqual(formatDuration(185_000), "3m 05s");
    assert.strictEqual(formatDuration(3_720_000), "1h 02m");
  });

  test("formats time since the run", () => {
    assert.strictEqual(formatAgo(3_000), "just now");
    assert.strictEqual(formatAgo(42_000), "42s ago");
    assert.strictEqual(formatAgo(5 * 60_000), "5 min ago");
    assert.strictEqual(formatAgo(3 * 3_600_000), "3 h ago");
  });

  test("formats a status line", () => {
    const now = 1_000_000;
    assert.strictEqual(
      formatStatus({ state: "running", startedAt: now - 2_000 }, now),
      "Running… 2.0s"
    );
    assert.strictEqual(
      formatStatus(
        { state: "error", startedAt: now - 60_400, endedAt: now - 60_000, exitCode: 1 },
        now
      ),
      "Last run: failed (exit 1) · 0.4s · 1 min ago"
    );
    assert.strictEqual(
      formatStatus({ state: "success", startedAt: now - 1_500, endedAt: now }, now),
      "Last run: succeeded · 1.5s · just now"
    );
    assert.strictEqual(
      formatStatus({ state: "unknown", startedAt: now, endedAt: now }, now),
      "Last run: sent, result unknown · just now"
    );
  });
});
