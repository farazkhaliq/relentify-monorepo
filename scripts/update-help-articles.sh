#!/usr/bin/env bash
# update-help-articles.sh — Weekly automation to keep 26help articles accurate.
# Runs MCP tests against 22accounting, captures recent app changes, then
# invokes Claude Code to review and update any stale MDX articles.
#
# Usage:
#   ./scripts/update-help-articles.sh          # full run (review + update + rebuild)
#   ./scripts/update-help-articles.sh --dry-run  # review only, no file edits
#
# Cron: 0 9 * * 1  (every Monday at 09:00)
# Log:  /var/log/help-articles.log

set -euo pipefail

MONOREPO="/opt/relentify-monorepo"
MCP_DIR="/opt/infra/mcp/22accounting-mcp"
CONTENT_DIR="$MONOREPO/apps/26help/content"
LOG="/var/log/help-articles.log"
CLAUDE="/root/.local/bin/claude"
DRY_RUN=false
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

log() { echo "[$TIMESTAMP] $*" | tee -a "$LOG"; }

log "=== Help article automation started (dry_run=$DRY_RUN) ==="

# ── 1. Run MCP tests ────────────────────────────────────────────────
log "Running 22accounting MCP test suite..."
MCP_OUTPUT=$(cd "$MCP_DIR" && source venv/bin/activate && python3 run_tests.py 2>&1) || {
    log "ERROR: MCP tests failed. Aborting article update."
    log "$MCP_OUTPUT"
    exit 1
}
MCP_SUMMARY=$(echo "$MCP_OUTPUT" | tail -20)
log "MCP tests: $(echo "$MCP_OUTPUT" | grep 'RESULTS:')"

# ── 2. Gather recent 22accounting changes ───────────────────────────
log "Gathering recent git changes in apps/22accounting..."
GIT_CHANGES=$(cd "$MONOREPO" && git log --oneline --since="7 days ago" -- apps/22accounting/ 2>/dev/null || echo "(no recent commits)")
GIT_DIFF=$(cd "$MONOREPO" && git diff HEAD~20..HEAD --stat -- apps/22accounting/src/ 2>/dev/null | head -40 || echo "(no diff available)")

# ── 3. Build the prompt ─────────────────────────────────────────────
if $DRY_RUN; then
    EDIT_INSTRUCTION="Do NOT edit or create any files. Only report which articles need updating and what should change. Output a summary."
    GAP_INSTRUCTION="List any gaps but do NOT create files."
    ALLOWED_TOOLS="Read,Glob,Grep,Bash(git:*)"
else
    EDIT_INSTRUCTION="Edit any MDX files that are inaccurate or incomplete. Preserve frontmatter exactly (title, description, category, order, appRoute, relatedArticles). Only update the body content. After editing, list every file you changed."
    GAP_INSTRUCTION="For each gap, create a new MDX file in the appropriate content directory. Use the same frontmatter schema as existing articles (title, description, category, order, appRoute, relatedArticles). Set order to 99 so it sorts last. Write a complete step-by-step article in the same style as existing ones."
    ALLOWED_TOOLS="Read,Glob,Grep,Edit,Write,Bash(git:*)"
fi

PROMPT=$(cat <<'PROMPT_END'
You are reviewing the Relentify help articles for accuracy.

## Context

The 22accounting app (accounting.relentify.com) has help articles in:
  /opt/relentify-monorepo/apps/26help/content/accounting/*.mdx
  /opt/relentify-monorepo/apps/26help/content/api/*.mdx

Each article is MDX with YAML frontmatter (title, description, category, order, appRoute, relatedArticles).
The body describes a feature step-by-step for end users.

## MCP Test Results (proves current app behaviour)

PROMPT_END
)

PROMPT="$PROMPT
$MCP_SUMMARY

## Recent Git Changes in apps/22accounting/ (last 7 days)

Commits:
$GIT_CHANGES

Files changed:
$GIT_DIFF

## Your Task

1. Read every MDX file in the accounting and api content directories.
2. Compare each article against the MCP test output and recent changes.
3. Flag any article where:
   - A step no longer matches the current UI flow (button names, field names, menu locations)
   - A feature described has been removed or significantly changed
   - New behaviour proven by MCP tests is not covered
4. $EDIT_INSTRUCTION

## Gap Detection

5. Compare the MCP test output against existing articles. Each MCP-tested feature
   (customers, suppliers, invoices, quotes, bills, credit notes, expenses, mileage,
   purchase orders, projects, COA, journals, banking, reports, VAT, period locks,
   attachments, comments, multi-entity, settings, audit log, cron, diagnostics, UI pages)
   should have a corresponding help article.
6. Report any features proven by MCP tests that have NO matching article.
7. $GAP_INSTRUCTION

## Rules
- Keep articles short and scannable (numbered steps, bold UI labels)
- Do not add videoUrl fields
- Do not change frontmatter fields unless the title/description is factually wrong
- Write for non-technical small business owners
- Be concise — report only what changed and why
"

# ── 4. Invoke Claude Code ───────────────────────────────────────────
log "Invoking Claude Code (non-interactive)..."
CLAUDE_OUTPUT=$($CLAUDE -p "$PROMPT" \
    --allowedTools "$ALLOWED_TOOLS" \
    --model sonnet \
    --max-turns 30 \
    -d "$MONOREPO" \
    2>&1) || {
    log "ERROR: Claude Code invocation failed."
    log "$CLAUDE_OUTPUT"
    exit 1
}

log "Claude Code output:"
echo "$CLAUDE_OUTPUT" >> "$LOG"

# ── 5. Rebuild 26help if files were edited ──────────────────────────
if ! $DRY_RUN; then
    CHANGED=$(cd "$MONOREPO" && { git diff --name-only -- apps/26help/content/; git ls-files --others --exclude-standard -- apps/26help/content/; } 2>/dev/null)
    if [[ -n "$CHANGED" ]]; then
        log "Articles updated — rebuilding 26help container..."
        cd "$MONOREPO"
        docker compose -f apps/26help/docker-compose.yml down
        docker compose -f apps/26help/docker-compose.yml build --no-cache
        docker compose -f apps/26help/docker-compose.yml up -d
        docker builder prune -f
        log "26help rebuilt and redeployed."

        # Commit the changes
        cd "$MONOREPO"
        git add apps/26help/content/
        git commit -m "[help] Auto-update articles from weekly review

Changes detected by automated MCP test comparison.
Run: $TIMESTAMP

Co-Authored-By: Claude Code <noreply@anthropic.com>"
        log "Changes committed."
    else
        log "No article changes needed — all articles are current."
    fi
else
    log "Dry run complete — no files were modified."
fi

log "=== Help article automation finished ==="
