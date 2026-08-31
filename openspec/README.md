# openspec

This directory is the committed trail of Spec-Driven Development (SDD) artifacts for this project.

Each change lives in its own folder:

```
openspec/changes/<change-name>/
  explore.md    # investigation and options considered
  proposal.md   # approved intent, scope, approach
  spec.md       # requirements and scenarios
  design.md     # technical design and architecture decisions
  tasks.md      # implementation task checklist
```

Not every change has every file — only the phases that have run so far exist. Files are added as a change progresses through the SDD pipeline (explore → proposal → spec/design → tasks → apply → verify → archive).

See `openspec/changes/define-stack/` for the first artifact: the exploration behind the project's technology stack decision.
