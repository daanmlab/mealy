---
name: review-git-changes
description: 'Review git status changes with coding principles in mind. Use when inspecting unstaged or staged edits, checking diffs for code quality, trimming excessive comments, and deciding whether a change is ready to keep or needs follow-up edits.'
argument-hint: '[optional focus area or coding principles to emphasize]'
---

# Review Git Changes

Use this skill to inspect local repository changes, evaluate them against coding principles, and reduce comment noise without removing useful context.

## When to Use

- Review current worktree changes before commit or PR creation.
- Check whether recent edits are minimal, clear, and aligned with project conventions.
- Remove comments that restate obvious code or add maintenance noise.
- Produce a short findings-first review of local changes.

## Inputs

- Optional focus area such as performance, readability, testing, API design, or type safety.
- Optional coding principles to apply if the user names them explicitly.

## Procedure

1. Inspect the current worktree state with git status.
2. Identify the narrowest review surface first:
- Prefer only changed files.
- If there are both staged and unstaged changes, consider both unless the user limits scope.
3. Review the diff file by file.
4. For each file, evaluate the change against these principles unless the user provides others:
- Fix root causes instead of patching symptoms.
- Keep changes minimal and consistent with existing patterns.
- Prefer clear names and straightforward control flow over cleverness.
- Avoid adding comments that merely narrate obvious code.
- Preserve comments that explain non-obvious intent, invariants, edge cases, or external constraints.
- Check whether tests or validation should change alongside behavior changes.
5. Separate findings into:
- Correctness or regression risk
- Maintainability or readability issues
- Excessive, redundant, or outdated comments
- Missing validation, tests, or error handling
6. If the task includes cleanup, edit the changed files directly:
- Remove comments that duplicate the code line-for-line.
- Compress verbose block comments into a short intent-level note only when needed.
- Do not remove comments that document business rules, safety constraints, workarounds, or surprising behavior.
- Do not broaden scope into unrelated refactors.
7. Run the cheapest focused validation available for the touched slice.
8. Summarize results with findings first, then note validations run and any residual risks.

## Decision Points

- If there are no git changes, report that immediately and stop.
- If the current file only wires through behavior, step to the nearest changed code that makes the actual decision.
- If a comment seems redundant but guards against a subtle misunderstanding, keep it and shorten only if clarity improves.
- If removing comments exposes confusing code, prefer a small code cleanup or one concise intent-level comment.
- If validation is unavailable, state that explicitly rather than implying confidence.

## Completion Checks

- The user knows which changed files were reviewed.
- Findings are prioritized by severity and tied to the actual diff.
- Excessive comments were removed or explicitly justified for retention.
- Any edits stayed within the requested scope.
- At least one focused validation was run when the environment allowed it.

## Output Shape

Use a concise findings-first response:

1. Findings, ordered by severity, with file references when relevant.
2. Comment cleanup performed, if any.
3. Validation run and remaining risks.

If no issues are found, say so explicitly and still mention any testing gap or unvalidated risk.