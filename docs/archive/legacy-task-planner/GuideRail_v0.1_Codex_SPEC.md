# GuideRail v0.1 — Chrome Side Panel Extension
## Engineering SPEC for Codex

**Status:** Draft for implementation
**Version:** v0.1
**Target:** Chrome Extension (Manifest V3)
**Primary browser:** Google Chrome desktop
**Primary site:** ChatGPT Web
**Primary user:** Single local user
**Data storage:** Local only
**AI integration:** Not included in v0.1

---

# 1. Product Summary

GuideRail is a Chrome Side Panel extension that keeps a persistent execution plan visible while the user works inside a long ChatGPT conversation.

The core problem:

A long implementation guide is usually posted once near the beginning of a conversation. As the user executes each step, debugging creates many new messages. The original guide becomes buried far above the current viewport.

GuideRail separates:

- **Plan** — what should be done
- **Step** — what the user is currently executing
- **Thread / Issue** — what went wrong during execution
- **Conversation** — where the discussion is happening

The extension must allow the user to keep the master plan visible in Chrome's side panel while continuing to chat normally in ChatGPT.

Example:

```text
┌──────────────────────────────┬────────────────────────────┐
│ ChatGPT                      │ GuideRail Side Panel       │
│                              │                            │
│ User: Step 8 failed...       │ Local TTS Deployment       │
│                              │                            │
│ Assistant: ...               │ 01 Environment       ✅   │
│                              │ 02 Tools             ✅   │
│ User: proxy_off works?       │ 03 Folder            ✅   │
│                              │ 04 Python env        ✅   │
│ Assistant: ...               │ 05 MLX Audio         ✅   │
│                              │ 06 API Server        ✅   │
│                              │ 07 Start Server      ✅   │
│                              │ 08 First Generate    🔵   │
│                              │    └ SOCKS issue     ✅   │
│                              │ 09 Voice Test             │
└──────────────────────────────┴────────────────────────────┘
```

---

# 2. Product Principle

GuideRail v0.1 is **not a new chat client**.

It must not attempt to replace ChatGPT.

It is a lightweight execution companion.

Core principle:

> Chat is the execution stream.
> Plan is the persistent source of truth.

---

# 3. Goals

GuideRail v0.1 must solve exactly these problems:

1. Detect the current ChatGPT conversation.
2. Allow the user to create or select a project.
3. Allow the user to create a persistent master plan.
4. Display that plan permanently in Chrome Side Panel.
5. Allow each plan step to have a status.
6. Allow the current ChatGPT conversation to be linked to a step.
7. Allow the user to record issues under a step.
8. Store everything locally.
9. Restore the correct project/plan automatically when the user returns to the same ChatGPT conversation.

---

# 4. Non-Goals

Do **not** implement the following in v0.1:

- OpenAI API integration
- Claude API integration
- LLM summarization
- automatic extraction of plan from chat
- automatic issue detection
- automatic write-back into plan
- cloud sync
- login/account system
- collaboration
- mobile support
- Electron/Tauri desktop app
- Obsidian integration
- remote backend
- browser history scraping
- full ChatGPT message scraping
- replacing ChatGPT UI
- custom chat interface
- MCP
- local AI model
- vector database
- embeddings
- RAG
- agent workflow
- complex Markdown editor

If implementation starts drifting toward these areas, stop and return to the v0.1 scope.

---

# 5. Target User Flow

## First use

User opens:

```text
https://chatgpt.com/c/<conversation-id>
```

Then opens GuideRail Side Panel.

The extension detects:

```text
conversation_id = <conversation-id>
```

Side panel shows:

```text
No project linked to this conversation.

[Create Project]
[Link Existing Project]
```

User creates:

```text
Project: Local TTS Server
```

Then creates/pastes a plan.

Example:

```markdown
# Local TTS Deployment

- [x] STEP-01 Check environment
- [x] STEP-02 Install tools
- [x] STEP-03 Create folder
- [x] STEP-04 Create Python environment
- [ ] STEP-05 Install MLX-Audio
- [ ] STEP-06 Create start script
- [ ] STEP-07 Start server
- [ ] STEP-08 Generate first WAV
- [ ] STEP-09 Test voices
```

GuideRail renders this as a structured step list.

User selects:

```text
STEP-08 Generate first WAV
```

and clicks:

```text
Set Current Step
```

GuideRail stores:

```text
conversation_id → project_id → plan_id → current_step_id
```

---

# 6. Core Objects

The data model must contain four primary concepts:

```text
Project
Plan
Step
Thread
```

Plus ConversationBinding.

---

# 7. Data Model

Use TypeScript interfaces.

Suggested model:

```ts
type StepStatus =
  | "todo"
  | "current"
  | "done"
  | "blocked";

interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  activePlanId: string | null;
}

interface Plan {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  markdownSource: string;
  stepIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface Step {
  id: string;
  planId: string;

  key: string;
  title: string;

  status: StepStatus;

  order: number;

  notes?: string;

  threadIds: string[];

  createdAt: string;
  updatedAt: string;
}

interface Thread {
  id: string;
  stepId: string;

  title: string;
  description?: string;

  conversationId?: string;

  resolved: boolean;

  createdAt: string;
  updatedAt: string;
}

interface ConversationBinding {
  conversationId: string;

  projectId: string;
  planId: string;

  currentStepId?: string;

  pageUrl: string;

  createdAt: string;
  updatedAt: string;
}
```

---

# 8. Storage

Use:

```text
chrome.storage.local
```

Do not add IndexedDB unless absolutely necessary.

Expected dataset size is tiny.

Recommended top-level storage shape:

```ts
interface GuideRailStorage {
  projects: Record<string, Project>;
  plans: Record<string, Plan>;
  steps: Record<string, Step>;
  threads: Record<string, Thread>;
  conversationBindings: Record<string, ConversationBinding>;
}
```

All writes must update `updatedAt`.

Use UUIDs for internal IDs.

Do not use Conversation ID as the primary ID for Project or Plan.

---

# 9. Conversation ID Detection

For ChatGPT URLs in the form:

```text
https://chatgpt.com/c/<conversation-id>
```

extract:

```text
<conversation-id>
```

Example:

```ts
function getChatGPTConversationId(url: string): string | null
```

Expected:

```text
https://chatgpt.com/c/abc-123
→ abc-123
```

If the page does not contain `/c/<id>`:

```text
conversationId = null
```

The extension must not crash.

Show:

```text
No saved ChatGPT conversation detected.
```

Do not rely on private ChatGPT APIs.

Do not scrape internal application state.

URL parsing is enough for v0.1.

---

# 10. Chrome Extension Architecture

Use Manifest V3.

Recommended structure:

```text
guiderail/
│
├── manifest.json
│
├── package.json
│
├── tsconfig.json
│
├── vite.config.ts
│
├── README.md
│
├── src/
│   ├── background/
│   │   └── service-worker.ts
│   │
│   ├── content/
│   │   └── chatgpt-content.ts
│   │
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── ProjectHeader.tsx
│   │       ├── ProjectSelector.tsx
│   │       ├── PlanView.tsx
│   │       ├── StepItem.tsx
│   │       ├── StepEditor.tsx
│   │       ├── ThreadList.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── storage/
│   │   ├── schema.ts
│   │   └── storage.ts
│   │
│   ├── domain/
│   │   ├── project.ts
│   │   ├── plan.ts
│   │   ├── step.ts
│   │   └── conversation.ts
│   │
│   └── shared/
│       ├── ids.ts
│       └── time.ts
│
└── tests/
```

React + TypeScript + Vite is acceptable.

Avoid large UI frameworks unless necessary.

Simple CSS is preferred.

---

# 11. Chrome Permissions

Keep permissions minimal.

Expected:

```json
{
  "permissions": [
    "sidePanel",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "https://chatgpt.com/*"
  ]
}
```

Do not request:

```text
history
cookies
webRequest
clipboardRead
```

unless required by a concrete implemented feature.

---

# 12. Side Panel Behavior

The Side Panel is the primary product surface.

It must remain available while the user scrolls and chats.

Primary layout:

```text
┌────────────────────────────┐
│ Local TTS Server        ⋮ │
├────────────────────────────┤
│ PLAN                       │
│                            │
│ ✅ 01 Environment           │
│ ✅ 02 Tools                 │
│ ✅ 03 Folder                │
│ ✅ 04 Python               │
│ 🔵 05 Install MLX          │
│ ☐ 06 Start script          │
│ ☐ 07 Start server          │
│ ☐ 08 First WAV             │
│                            │
├────────────────────────────┤
│ Selected Step              │
│ STEP-05 Install MLX        │
│                            │
│ Issues                     │
│ • SOCKS proxy ✅           │
│                            │
│ [+ Add Issue]              │
└────────────────────────────┘
```

---

# 13. Step Status

Each Step must support:

```text
todo
current
done
blocked
```

Suggested visual language:

```text
☐ todo
🔵 current
✅ done
⚠ blocked
```

Only one Step per Plan should normally be `current`.

When user marks another Step `current`:

previous current step should become:

```text
todo
```

unless it was already `done`.

---

# 14. Project Creation

User can create Project from side panel.

Required fields:

```text
Project Name
```

Optional:

```text
Description
```

Example:

```text
Local TTS Server
```

After creation:

- create Project
- create empty Plan
- bind current conversation
- show Plan editor

---

# 15. Plan Input

For v0.1 support two input modes:

## A. Structured Step Creation

User clicks:

```text
+ Add Step
```

and provides:

```text
Step Key
Step Title
```

Example:

```text
STEP-08
Generate first WAV
```

## B. Simple Markdown Import

Allow user to paste Markdown checklist text.

Supported lines:

```markdown
- [ ] STEP-01 Check environment
- [x] STEP-02 Install tools
```

Parser behavior:

```text
[x] → done
[ ] → todo
```

Everything else may be preserved in `markdownSource`.

Do not build a full Markdown parser.

Use a narrow parser for checklist lines.

---

# 16. Step Selection

Clicking a Step should:

1. select the Step
2. display details below
3. allow status change
4. allow setting as current step
5. show Issues / Threads

Selected Step is a UI state.

Current Step is persisted data.

Do not confuse them.

---

# 17. Conversation Binding

When the current ChatGPT page has:

```text
conversation_id = X
```

GuideRail must lookup:

```text
conversationBindings[X]
```

If found:

automatically load:

```text
Project
Plan
Current Step
```

If not found:

show:

```text
This conversation is not linked.

[Link to Current Project]
[Create New Project]
```

---

# 18. Thread / Issue

A Thread represents a debugging or side discussion under one Step.

Example:

```text
STEP-08 First Generate
│
├── SOCKS proxy issue
├── Hugging Face download slow
└── WAV returned JSON
```

For v0.1 Thread fields:

```text
title
description
resolved
conversationId
```

User actions:

```text
Add Issue
Mark Resolved
Delete Issue
```

When creating an Issue from the current conversation:

default:

```text
conversationId = current ChatGPT conversation ID
```

---

# 19. Deep Link Behavior

If possible, store:

```text
pageUrl
```

Example:

```text
https://chatgpt.com/c/xxxx
```

For each Thread.

Clicking:

```text
Open Conversation
```

should open that URL in a new tab.

Do not attempt message-level anchors in v0.1.

Conversation-level navigation is sufficient.

---

# 20. UI Requirements

Visual direction:

- minimal
- compact
- readable
- professional
- not decorative
- optimized for narrow side panel width

Avoid:

- gradients
- oversized cards
- dashboard aesthetics
- excessive animation
- giant icons

Prefer:

```text
text
status icon
thin separators
small buttons
simple hierarchy
```

The Plan must remain visible with minimal scrolling.

---

# 21. Main Screens / States

The application must handle these states:

## State A — unsupported page

```text
GuideRail
Open a ChatGPT conversation to link a plan.
```

## State B — conversation not linked

```text
Conversation detected

[Create Project]
[Link Existing Project]
```

## State C — project linked

Display normal Plan.

## State D — empty plan

```text
No steps yet.

[Add Step]
[Paste Markdown Plan]
```

## State E — selected Step

Display Step details and Issues.

---

# 22. Required Actions

Minimum actions for v0.1:

### Project
- create
- rename
- select

### Plan
- edit title
- import Markdown checklist

### Step
- create
- edit
- delete
- reorder
- set todo
- set current
- set done
- set blocked

### Thread
- create
- edit
- resolve
- delete
- open linked conversation

### Conversation
- detect
- bind to project/plan
- restore binding

---

# 23. Reordering

Use simple up/down controls for v0.1:

```text
↑
↓
```

Do not implement drag-and-drop unless trivial.

Correctness is more important than polish.

---

# 24. Persistence Requirements

After browser restart:

- Projects remain
- Plans remain
- Steps remain
- Issues remain
- Conversation links remain
- Current Step remains

No state should depend only on React memory.

---

# 25. Export / Backup

Add a simple:

```text
Export JSON
```

feature.

It should download the complete GuideRail storage state.

Example:

```text
guiderail-backup-2026-09-05.json
```

Also provide:

```text
Import JSON
```

with validation.

This is important because v0.1 has no cloud sync.

---

# 26. Safety Against Data Loss

Before destructive actions:

```text
Delete Project
Delete Step
Delete Thread
```

ask for confirmation.

Do not silently overwrite existing imported data.

For Import JSON:

offer:

```text
Replace Existing Data
```

Only replace after explicit confirmation.

---

# 27. Error Handling

Never show raw JavaScript errors to normal UI.

Show concise messages:

```text
Could not save project.
Could not detect conversation.
Invalid GuideRail backup file.
```

Log technical details to console.

---

# 28. Test Requirements

At minimum implement unit tests for:

## URL parser

```text
https://chatgpt.com/c/abc123
→ abc123
```

```text
https://chatgpt.com/
→ null
```

## Markdown parser

```markdown
- [x] STEP-01 Install tools
```

→

```json
{
  "key": "STEP-01",
  "title": "Install tools",
  "status": "done"
}
```

## Storage

- create project
- create step
- update status
- create binding
- restore binding

---

# 29. Manual Acceptance Test

The implementation is complete only when this exact workflow works:

### Test Project

Open a real ChatGPT conversation.

Open GuideRail.

Create:

```text
Project:
Local TTS Server
```

Paste:

```markdown
- [x] STEP-01 Check Mac environment
- [x] STEP-02 Install Python and ffmpeg
- [x] STEP-03 Create tts-server folder
- [x] STEP-04 Create Python environment
- [x] STEP-05 Install MLX-Audio
- [x] STEP-06 Create start script
- [x] STEP-07 Start API server
- [ ] STEP-08 Generate first WAV
- [ ] STEP-09 Test voices
- [ ] STEP-10 Configure launchd
```

Expected:

GuideRail creates 10 Steps.

Then:

Set:

```text
STEP-08
```

to:

```text
current
```

Add Issue:

```text
SOCKS proxy prevents Hugging Face model download
```

Mark Issue:

```text
resolved
```

Close Chrome.

Reopen Chrome.

Return to same ChatGPT conversation.

Expected:

```text
Project = Local TTS Server
Current Step = STEP-08
Issue still exists
Issue status = resolved
```

If this works, v0.1 core is successful.

---

# 30. Definition of Done

GuideRail v0.1 is done when:

- Chrome extension installs in Developer Mode
- Side Panel opens
- ChatGPT Conversation ID is detected
- Project can be created
- Markdown checklist can become Steps
- Step status can be changed
- Conversation can bind to Project and Step
- Issue can be stored under Step
- linked conversation can be reopened
- state survives browser restart
- JSON export works
- JSON import works
- no backend is required
- no API key is required

---

# 31. Development Priorities

Implement in this order:

```text
P0
Chrome extension shell
Side Panel
Storage schema
Conversation URL parser

P1
Project CRUD
Plan CRUD
Step CRUD

P2
Conversation binding
Current Step

P3
Thread / Issue

P4
Markdown import

P5
Export / Import

P6
UI cleanup
Tests
README
```

Do not start P4/P5/P6 before P0-P3 work reliably.

---

# 32. Suggested Development Milestones

## Milestone 1 — Skeleton

Deliver:

- Manifest V3
- Side Panel opens
- displays current URL
- extracts conversation ID

Acceptance:

```text
chatgpt.com/c/abc
→ UI displays abc
```

---

## Milestone 2 — Plan

Deliver:

- create project
- add steps
- status controls
- persistence

Acceptance:

refresh browser and data remains.

---

## Milestone 3 — Binding

Deliver:

```text
conversation ↔ project ↔ current step
```

Acceptance:

return to conversation and correct project automatically loads.

---

## Milestone 4 — Issues

Deliver:

- add issue
- resolve issue
- conversation URL link

---

## Milestone 5 — Import / Export

Deliver:

- Markdown checklist import
- JSON backup
- JSON restore

---

# 33. Engineering Constraints

Prefer:

```text
TypeScript
React
Vite
Chrome Manifest V3
chrome.storage.local
```

Avoid unnecessary dependencies.

Do not add a backend.

Do not add database servers.

Do not introduce Docker.

Do not require Node.js at runtime after the extension is built.

---

# 34. Code Quality

Requirements:

- TypeScript strict mode
- domain types centralized
- storage access abstracted through one module
- no direct `chrome.storage.local` calls scattered across UI components
- parsing logic unit tested
- avoid giant React components
- clear README

---

# 35. README Requirements

README must explain:

1. What GuideRail solves
2. Architecture
3. Development setup
4. Build command
5. How to install unpacked Chrome extension
6. How Conversation ID detection works
7. Data stored locally
8. How to export backups
9. Current limitations
10. v0.1 non-goals

---

# 36. Future Architecture Notes

Do not implement yet, but keep architecture compatible with future:

```text
GuideRail Core
      │
      ├── Chrome Extension
      ├── Claude Adapter
      ├── Grok Adapter
      ├── Obsidian
      ├── Local Web UI
      └── Agent
```

Future storage may move from:

```text
chrome.storage.local
```

to:

```text
Local Core Server
+
SQLite
+
Markdown files
```

Therefore domain logic should not be tightly coupled to Chrome storage.

Use a repository-like abstraction:

```ts
interface StorageRepository {
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;

  getPlan(id: string): Promise<Plan | null>;
  savePlan(plan: Plan): Promise<void>;

  getStep(id: string): Promise<Step | null>;
  saveStep(step: Step): Promise<void>;

  getBinding(conversationId: string):
    Promise<ConversationBinding | null>;
}
```

Chrome storage implementation:

```text
ChromeStorageRepository
```

Future:

```text
LocalServerRepository
```

---

# 37. Explicit Product Boundary

Codex must continuously check implementation decisions against this sentence:

> GuideRail v0.1 exists to keep a persistent master execution plan visible and linked to the current ChatGPT conversation.

If a feature does not directly support that sentence, it probably does not belong in v0.1.

---

# 38. Final Instruction to Codex

Implement incrementally.

Do not build everything in one pass.

After each milestone:

1. run tests
2. build extension
3. verify manually
4. fix errors
5. only then proceed

First deliver a working Milestone 1 before implementing the rest.

Do not redesign the product scope without an explicit user request.

When uncertain, choose the simpler implementation.
