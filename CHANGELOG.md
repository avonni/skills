# Changelog

All notable changes to the Avonni skills are documented in this file. Versions follow the rules in [`CONTRIBUTING.md`](CONTRIBUTING.md#versioning).

## 1.1.0 - 2026-11-09

### avonni-dynamic-components 1.1.0

#### Added

-   Variable types for date literals, date functions and distances, and orders by distance.

#### Fixed

-   Reading a component decodes `&apos;` and numeric entities such as `&#x27;`, which Salesforce writes for apostrophes. They were kept as text and saved back double-escaped.

### avonni-experience-components 1.1.0

#### Added

-   Distance filters and orders by distance in queries.

### avonni-flow-components 1.1.0

#### Added

-   Distance filters and orders by distance in queries.

### avonni-lwc-components 1.1.0

#### Added

-   Distance filters and orders by distance in queries.

## 1.0.0 - 2026-10-21

First release as a Claude Code and Codex plugin, and the baseline for the versioning rules. Earlier changes weren't versioned consistently, so they aren't listed.

Skill versions:

-   avonni-architect 1.0.0
-   avonni-dynamic-components 1.0.1
-   avonni-experience-components 1.0.0
-   avonni-flow-components 1.0.0
-   avonni-lwc-components 1.0.0
