# Architecture Planning Instructions

Your goal is to create an architecture plan describing the Avonni artifacts that will be built, how they connect, and in which order. The plan will be output to a non-technical user.

## Ground the Plan in the MCP

The plan stays at artifact granularity — component selection within an artifact is the owning skill's job. Ground it with shallow, read-only MCP calls:

1. Read `references/composition-matrix.md` to know which artifact types can call or embed which, and through which interactions.
2. Call `list_components` once per toolset that appears in the candidate architecture, so the plan names real surfaces. Do not call `get_component_docs`.
3. Call `list_interactions` once per **calling** artifact's toolset. A cross-artifact link may appear in the plan only if its interaction is present in the returned list — the matrix tells you where to look; the MCP confirms it exists.

## Describe Each Artifact

For each artifact in the plan, state:

-   Its type and owning skill (see the Role table in `SKILL.md`).
-   Its purpose in the use case, in natural language.
-   The surface hosting it (record page, Experience site page and view, screen flow).
-   The interactions wiring it to other artifacts, using interaction labels (e.g. "opens the Submit Request flow in a dialog via Open Flow Dialog").
-   The identifiers it must expose for its callers (flow API name, dynamic component name).

Keep the descriptions understandable by a non-technical user. Do not list component properties.

## Fix the Build Order

End the plan with a numbered **build order**, one line of justification per dependency edge. Order artifacts topologically — callee before caller:

1. Flows before anything that launches them: the Execute Flow, Open Flow Dialog, and Open Flow Panel interactions reference the flow API name, which must exist first.
2. Callee dynamic components before the dynamic components that open them via dialog or panel.
3. A flow and its Avonni screen components are one unit — `avonni-flow-components` builds both in a single dispatch.
4. Experience site components last among artifacts that only consume others, since site views typically reference flows and navigation targets.
5. If two artifacts reference each other (A opens B and B opens A): build both with the wiring in one direction only, then dispatch an **update** invocation of the first artifact's skill to add the back-reference. Call this out explicitly in the plan.

## Out of Scope and Missing Pieces

Close the plan with a section listing what will not be built and why:

-   Pieces the artifact skills scope out: site/route/theme/page creation, general flow logic (decisions, assignments, record operations), custom objects and fields — these must already exist or be handled outside this skill.
-   Artifacts whose owning skill is not available in the session (see Prerequisites), and any artifact that depends on them.

The user validates the plan knowing these gaps.

## Dispatch Briefs

At dispatch time (Step 4 of `SKILL.md`), invoke each owning skill through the Skill tool with a self-contained natural-language brief as its argument, containing:

1. That artifact's slice of the validated architecture plan — purpose, hosting surface, and the cross-artifact interactions it must include.
2. The identifiers of already-built dependencies (flow API name, dynamic component name, file paths), captured in Step 5.
3. A note that the overall architecture has been validated by the user, and that the skill should run its own plan → validate loop scoped to this artifact only.
4. A note that this artifact is part of a larger build (artifact N of M): after its summary, the orchestration continues with the next artifact in the same turn — the artifact's summary must not be presented as the end of the overall task, and remaining artifacts must be named after it.
