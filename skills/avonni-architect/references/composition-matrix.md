# Composition Matrix

Which Avonni artifact can call or embed which, and which skill owns building each. This file is a routing aid: it tells you where to look. The existence of every interaction used in a plan must still be confirmed by `list_interactions` on the calling artifact's toolset — if the MCP disagrees with this file, the MCP wins.

## Artifact Types and Owners

| Artifact type                                  | Owning skill            | Toolset      | Output                                       |
| ---------------------------------------------- | ----------------------- | ------------ | -------------------------------------------- |
| Avonni Dynamic Component                       | `dynamic-components`    | `dynamic`    | Custom metadata record file (component JSON) |
| Avonni Flow Screen Components (screen flow)    | `flow-components`       | `flow`       | `.flow-meta.xml` file                        |
| Avonni components in a Digital Experience site | `experience-components` | `experience` | Modified site view `content.json`            |

## Who Can Call Whom

One row per verified edge. "Caller needs" is the identifier the interaction references, which therefore must exist before the caller is built.

| Caller                | Target            | Interactions                                                 | Caller needs           |
| --------------------- | ----------------- | ------------------------------------------------------------ | ---------------------- |
| Dynamic Component     | Flow              | Execute Flow (background), Open Flow Dialog, Open Flow Panel | Flow API name          |
| Dynamic Component     | Dynamic Component | Open Dynamic Component Dialog, Open Dynamic Component Panel  | Dynamic component name |
| Flow Screen Component | Flow              | Open Flow Dialog, Open Flow Panel                            | Flow API name          |
| Experience component  | Flow              | Open Flow Dialog, Open Flow Panel                            | Flow API name          |

## Containment (Not Interactions)

-   Flows **contain** Avonni Flow Screen Components — building both is `flow-components`' job, in one dispatch.
-   Digital Experience site views **host** Avonni (`avxp:`/`avcmpbuilder:`) components — `experience-components`' job. The site, route, and view must already exist.

## Dependency Rules

-   Any caller of Execute Flow / Open Flow Dialog / Open Flow Panel needs the flow API name → build the flow first.
-   Any caller of Open Dynamic Component Dialog / Panel needs the target component's name → build the callee component first.
