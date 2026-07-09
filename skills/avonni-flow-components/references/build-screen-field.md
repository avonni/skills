# Screen Field Generation Instructions

This file defines how to turn MCP component documentation into Avonni screen component fields inside a `.flow-meta.xml` file. Follow it strictly. Read `references/data-sources.md`, `references/interactions.md`, and `references/styling.md` when the component uses a data source, interactions, or styling respectively.

## Field Anatomy (Mandatory)

Each Avonni component instance is one `<fields>` element inside a `<screens>` element. Its children MUST appear in this exact order:

```xml
<fields>
    <name>accountList</name>
    <dataTypeMappings>
        <typeName>T</typeName>
        <typeValue>Account</typeValue>
    </dataTypeMappings>
    <extensionName>avcmpbuilder:avatarGroup</extensionName>
    <fieldType>ComponentInstance</fieldType>
    <inputParameters>
        <name>title</name>
        <value>
            <stringValue>My Accounts</stringValue>
        </value>
    </inputParameters>
    <inputsOnNextNavToAssocScrn>UseStoredValues</inputsOnNextNavToAssocScrn>
    <isRequired>true</isRequired>
    <storeOutputAutomatically>true</storeOutputAutomatically>
</fields>
```

-   `name` — the field API name. See **API Name Rules** below.
-   `dataTypeMappings` — see **Data Type Mappings** below.
-   `extensionName` — always `avcmpbuilder:` followed by the component `name` exactly as returned by `list_components` (camelCase).
-   `fieldType` — always `ComponentInstance`.
-   `inputParameters` — one block per configured property, in any order.
-   `inputsOnNextNavToAssocScrn` — always `UseStoredValues`.
-   `isRequired` — always `true` (this is the Flow field flag, not the component's `required` property).
-   `storeOutputAutomatically` — always `true`, so other flow elements can reference the component outputs.

## Data Type Mappings

A component binds records through **generic sObject types**, declared concrete per field instance with `dataTypeMappings` blocks placed right after `<name>`.

-   Include the block(s) whenever the component's docs show a `query` or `variables` data source, or any property of type `record`/`record[]` — on **every** instance of that component, even when its data is static. Omit entirely for other components.
-   The component's generic types are `T`, plus one type per distinct `sObjectType` declared on its `dataSources` entries (e.g. an entry with `"sObjectType": "R"` adds an `R` type). Write one block per type, `T` first:

```xml
<dataTypeMappings>
    <typeName>T</typeName>
    <typeValue>Event</typeValue>
</dataTypeMappings>
<dataTypeMappings>
    <typeName>R</typeName>
    <typeValue>User</typeValue>
</dataTypeMappings>
```

-   `typeValue` is the object API name bound to that type's data: an entry declaring an `sObjectType` maps its object to that type; all other record bindings map to `T`.
-   When nothing is record-bound (static data), still include the block(s), using the `Account` object.

## API Name Rules (Global)

-   Field names must be unique across the whole flow (all screens, all elements, all resources).
-   Must start with a letter, contain only letters, numbers, and underscores, and not end with an underscore or contain two consecutive underscores.
-   Derive the name from the component and its purpose, in camelCase (e.g. `contactPicker`, `orderSummaryTable`).

## Input Parameter Mapping

Every parameter name is the property `name` exactly as documented by the MCP. Never invent parameter names: the only parameters allowed beyond the MCP docs are the serialization and data source parameters defined in this skill (`*Serialized`, `itemsTypeSelected`, `*SObject`, `*SObjectApiName`, `*SObjectMapping`, `picklist*`, `query*`, `systemContext`, `inlineStyle`).

### Value Encoding by Documented Type

| MCP doc type                                 | Literal value encoding                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `string`, `icon`, `url`, `color`, `richtext` | `<stringValue>` (richtext is an HTML string)                                                                |
| `date`, `datetime`, `time`                   | `<stringValue>` (ISO format)                                                                                |
| `number`                                     | `<numberValue>`                                                                                             |
| `boolean`                                    | `<booleanValue>` (`true`/`false`)                                                                           |
| `object`                                     | `<stringValue>` containing the JSON object, under the property's own name                                   |
| `object[]`, `string[]`, `number[]`, `date[]` | `<stringValue>` containing the JSON array, under **`<propertyName>Serialized`**                             |
| `interaction[]`                              | `<stringValue>` containing the JSON array, under the property's own name (see `references/interactions.md`) |
| `record`, `record[]`                         | never literal — always an `<elementReference>` to a flow record (collection) variable                       |

To bind any property to a flow resource instead of a literal, use `<elementReference>resourceName</elementReference>` (no `{!}` braces). Collection-typed properties bound to a flow variable use their **base** name, not the `Serialized` variant:

```xml
<!-- literal -->
<inputParameters>
    <name>valueCollectionSerialized</name>
    <value>
        <stringValue>["optionA","optionB"]</stringValue>
    </value>
</inputParameters>

<!-- bound to a flow variable -->
<inputParameters>
    <name>valueCollection</name>
    <value>
        <elementReference>selectedValues</elementReference>
    </value>
</inputParameters>
```

If a documented property name already ends in `Serialized`, use it as is. Most collection properties are documented under their serialized name directly; the append-`Serialized` rule above is the fallback for the few documented under their base name.

### Parameter Rules

-   Always include properties the user request needs; omit every property whose value equals the documented default.
-   Only use object keys defined in the documented property schema (`properties` of `object`/`object[]` types). Inside JSON values, use the documented key names verbatim.
-   Never include a parameter with an empty value. The only exception is `systemContext`, which is intentionally left empty for the fix script to fill (see **System Context**).

### Icon Rules (Strict)

For any property of type `icon`:

-   Use only valid Salesforce Lightning Design System icons, in the format `category:icon-name` (for example `standard:account`, `utility:warning`).
-   Never invent icons.

### Conditional Properties

Some properties can be used only if a condition is met (`"when": { condition }`). You can use them only if the component value matches the condition.
For example:

-   `"when": { "variant": ["bare", "destructive"] }` means this property can be used only if the component's `variant` is `bare` or `destructive`.
-   `"when": { "variant": true }` means this property can be used if any `variant` value is set.

## JSON in XML

JSON payloads (`*Serialized`, `object` properties, `*SObjectMapping`, interaction arrays, `systemContext`) are written as a single-line JSON string inside `<stringValue>`, XML-escaped:

-   `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`
-   No pretty-printing, no trailing whitespace.

Example — a static combobox options list:

```xml
<inputParameters>
    <name>optionsSerialized</name>
    <value>
        <stringValue>[{&quot;label&quot;:&quot;Option A&quot;,&quot;value&quot;:&quot;optionA&quot;},{&quot;label&quot;:&quot;Option B&quot;,&quot;value&quot;:&quot;optionB&quot;}]</stringValue>
    </value>
</inputParameters>
```

## System Context

Add a `systemContext` parameter when the field uses a **query data source** or any interaction that refreshes queries (e.g. Refresh All Queries). **Never write its value yourself** — leave the `<stringValue>` empty, exactly like this:

```xml
<inputParameters>
    <name>systemContext</name>
    <value>
        <stringValue></stringValue>
    </value>
</inputParameters>
```

`scripts/fix-flow.mjs` generates the value and writes it into the file (the workflow runs it right before validation). When updating an existing field, never modify a `systemContext` value already present. Omit the parameter entirely when the field needs no system context.

## Component Outputs and Reactivity

Because `storeOutputAutomatically` is `true`, other flow elements can read a component's properties with `{!fieldName.propertyName}` (e.g. `{!contactPicker.selectedOption}` in a Display Text field, formula, or assignment). **Every documented property can be read as an output**, including input properties, which return their current value. Properties marked `outputOnly` in the docs are exclusively outputs — never write them as input parameters. Never reference a property that is not documented.

Components can also reference each other's properties directly: bind an input parameter with an `<elementReference>`. This works across screens (e.g. a component on a later screen consuming the rows selected on a previous one) as well as on the **same screen**, where the value updates live as the user interacts.

```xml
<inputParameters>
    <name>recordId</name>
    <value>
        <elementReference>accountTable.firstSelectedRow.Id</elementReference>
    </value>
</inputParameters>
```

-   The reference is `<fieldApiName>.<propertyName>`, optionally followed by a key of an object-typed property (e.g. `.firstSelectedRow.Id`).
-   For reactive query filters, point `queryFiltersExpression` to a text formula that builds the SOQL filter from another component's property (see `references/data-sources.md`).

## Inserting Fields into a Screen

Fields render on the screen in document order. Place each new `<fields>` block among the screen's children:

-   after the screen's `<connector>` (or `<allowPause>` when there is no connector) and before `<showFooter>`;
-   relative to the screen's existing fields, at the position the component should appear — at the end by default, unless the user asks otherwise.

This applies the same way whether the screen already contains Avonni components or none at all.

## Removing or Updating Fields (Update Path)

-   To update a field, edit only the `inputParameters` (and the `dataTypeMappings` `typeValue`s, if the bound object changes) of that field. Preserve its `name` so existing references keep working.
-   To remove a field, delete its whole `<fields>` block, then search the flow for `{!fieldName.` references and report any remaining usage to the user — do not delete those references yourself.
-   Never rename a field unless the user asks; renaming breaks `{!fieldName.*}` references.

## Validation Requirements (Mandatory)

Before writing the file, verify:

-   Every component name exists in `list_components`.
-   Every parameter name comes from the component docs or from the serialization parameters defined by this skill.
-   Every JSON payload only uses documented keys, and is XML-escaped.
-   Required properties (per the docs) are present.
-   `dataTypeMappings` blocks follow the **Data Type Mappings** rule: present (one per generic type) for components documenting a `query`/`variables` data source or `record`-typed properties, absent otherwise.
-   Field names are unique and valid.

After writing the file, always run `node <skill_base_directory>/scripts/fix-flow.mjs` then `node <skill_base_directory>/scripts/validate-flow.mjs` as instructed by the workflow.
