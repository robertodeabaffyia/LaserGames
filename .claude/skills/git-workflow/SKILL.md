---
name: git-workflow
description: Stage, commit, and optionally push changes for this game project. Run with /git-workflow [message].
disable-model-invocation: true
---

When the user runs `/git-workflow $ARGUMENTS`:

1. Run `git status` to show what's changed.
2. Stage relevant files (prefer specific file names over `git add .`; skip .env files and binaries).
3. If $ARGUMENTS is empty, draft a concise commit message from the diff.
4. Commit with the message (or $ARGUMENTS as the message if provided).
5. Ask: "Push to remote?" — only push if the user says yes.
6. If a remote is configured and they say yes, run `git push`.

Never amend published commits. Never use --no-verify.
