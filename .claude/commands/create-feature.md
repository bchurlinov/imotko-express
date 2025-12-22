---
description: Create new feature files for spec-driven development based on high-level requirements.
argument-hint: Feature name | Feature summary
---

# Spec-Driven Development Prompt given from above conversation
Transform the provided high-level requirements from the previous conversation into a complete set of project planning artifacts for spec-driven development.

## Instructions:
You must produce **four files** inside the `spec/` directories.
The directory  name would be the feature name derived from the arguments. The $ARGUMENTS variable contains the feature name. Create a folder with snake case.
- `spec/$ARGUMENTS/requirements.md`
- `spec/$ARGUMENTS/plan.md`
- `spec/$ARGUMENTS/tasks.md`
  Follow the methodology below step by step:
---
### Step 1: Create `spec/$ARGUMENTS/requirements.md`
- Title: **Requirements Document**
- Introduction: Summarize the requested feature purpose and key functionality.
- Requirements section:
    - Use sequential numbering (1, 2, 3, …).
    - Each requirement must include:
        - **User Story** in the format:
          > As a user, I want [goal] so that [benefit/reason]
        - **Acceptance Criteria** in the format:
          > WHEN [condition] THEN the system SHALL [expected behavior]
- Guidelines:
    - Focus on user goals and benefits.
    - Make acceptance criteria specific, testable, and precise.
    - Cover normal flows, edge cases, error handling, persistence, and UI/UX.
    - Group related requirements logically.
---
### Step 2: Create `spec/$ARGUMENTS/plan.md`
- Analyze `spec/$ARGUMENTS/requirements.md`.
- Develop a **detailed implementation plan**:
    - Link each plan item explicitly to the corresponding requirements.
    - Assign priorities (e.g., High, Medium, Low).
    - Group related plan items logically.
- Ensure comprehensive coverage of all requirements.
---
### Step 3: Create `spec/$ARGUMENTS/tasks.md`
- Based on the implementation plan in `spec/plan.md`, produce a **detailed enumerated technical task list**:
    - Each task must have a placeholder `[ ]` to mark completion.
    - Link each task both to:
        - the development plan item in `spec/$ARGUMENTS/plan.md`
        - the related requirement(s) in `spec/$ARGUMENTS/requirements.md`
- Group tasks into **development phases**.
- Organize phases logically (e.g., Setup → Core Features → Advanced Features).
---
## Input:
[INSERT YOUR HIGH-LEVEL REQUIREMENTS FOR THE FEATURE YOU WANT TO CREATE; ASK THE USER]
## Output:
1. `spec/$ARGUMENTS/requirements.md` – structured requirements document
2. `spec/$ARGUMENTS/plan.md` – implementation plan with priorities and links
3. `spec/$ARGUMENTS/tasks.md` – detailed enumerated task list grouped into phases