# AI Task Log

Use this file to track work done by Claude, Codex, or any other coding agent.

## Active Task

### Agent

Claude or Codex

### Branch

Name of current branch, if applicable.

### Task

Describe the current task.

### Files Allowed

List files or folders the agent is allowed to inspect/edit.

### Status

Not started / Investigating / Editing / Testing / Blocked / Done

---

## Completed Tasks

### YYYY-MM-DD — Agent Name — Short Task Title

**Task:**  
Describe what the agent was asked to do.

**Files Changed:**  
- file/path/example.tsx
- file/path/example.css

**Summary:**  
Briefly explain what changed.

**Verification:**  
- Build: pass/fail/not run
- Tests: pass/fail/not run
- Manual testing: describe result

**Remaining Issues:**  
List anything unresolved.

**Notes for Next Agent:**  
Explain what the next agent should know before continuing.

### 2026-05-07 — ChatGPT — Created Multi-Agent Coordination Files

**Task:**  
Create project coordination structure for alternating between Codex and Claude.

**Files Changed:**  
- AGENTS.md
- HANDOFF.md
- AI_TASK_LOG.md

**Summary:**  
Added rules for AI coding agents, a shared project handoff file, and a task log to prevent Claude and Codex from duplicating or reversing each other’s work.

**Verification:**  
- Build: not run
- Tests: not run
- Manual testing: not applicable

**Remaining Issues:**  
The handoff should be updated after each agent session.

**Notes for Next Agent:**  
Read AGENTS.md, HANDOFF.md, and AI_TASK_LOG.md before making any code changes. ChatGPT is coordinating the workflow.