import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../skills/dynamic-components/scripts/validate-component.mjs'
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(json) {
    const result = spawnSync('node', [SCRIPT], {
        input: typeof json === 'string' ? json : JSON.stringify(json, null, 2),
        encoding: 'utf8'
    });
    return {
        exitCode: result.status,
        stdout: result.stdout,
        stderr: result.stderr
    };
}

/** Asserts the script exits 0 and returns the parsed output JSON. */
function pass(json) {
    const { exitCode, stdout, stderr } = run(json);
    assert.equal(exitCode, 0, `Expected pass but got errors:\n${stderr}`);
    return JSON.parse(stdout);
}

/** Asserts the script exits 1 and that stderr contains the expected fragment. */
function fail(json, expectedFragment) {
    const { exitCode, stderr } = run(json);
    assert.equal(exitCode, 1, `Expected failure but script passed`);
    if (expectedFragment) {
        assert.ok(
            stderr.includes(expectedFragment),
            `Expected "${expectedFragment}" in stderr:\n${stderr}`
        );
    }
    return stderr;
}

// ---------------------------------------------------------------------------
// Base fixtures
// ---------------------------------------------------------------------------

const MINIMAL = {
    apiName: 'MyComponent',
    value: [],
    queries: [],
    resources: []
};

function minimal(overrides = {}) {
    return { ...MINIMAL, ...overrides };
}

function withComponent(comp, extra = {}) {
    return minimal({ value: [comp], ...extra });
}

function baseComp(name, apiName, value = {}, extra = {}) {
    return { name, apiName, value, ...extra };
}

describe('Validate Component JSON', () => {
    // ---------------------------------------------------------------------------
    // Top-level structure
    // ---------------------------------------------------------------------------

    describe('top-level structure', () => {
        test('minimal valid component passes', () => {
            pass(MINIMAL);
        });

        test('missing apiName', () => {
            const { apiName: _, ...rest } = MINIMAL;
            fail(rest, 'Missing required top-level field "apiName"');
        });

        test('missing value', () => {
            const { value: _, ...rest } = MINIMAL;
            fail(rest, 'Missing required top-level field "value"');
        });

        test('missing queries', () => {
            const { queries: _, ...rest } = MINIMAL;
            fail(rest, 'Missing required top-level field "queries"');
        });

        test('missing resources', () => {
            const { resources: _, ...rest } = MINIMAL;
            fail(rest, 'Missing required top-level field "resources"');
        });

        test('apiName exceeds 30 characters', () => {
            fail(minimal({ apiName: 'A'.repeat(31) }), 'exceeds 30 characters');
        });

        test('description exceeds 255 characters', () => {
            fail(
                minimal({ description: 'x'.repeat(256) }),
                'exceeds 255 characters'
            );
        });

        test('description at exactly 255 characters passes', () => {
            pass(minimal({ description: 'x'.repeat(255) }));
        });

        test('invalid JSON input', () => {
            fail('{not valid json', 'Invalid JSON');
        });

        test('JSON root is an array', () => {
            fail('[]', 'JSON root must be an object');
        });
    });

    // ---------------------------------------------------------------------------
    // apiName format
    // ---------------------------------------------------------------------------

    describe('apiName format', () => {
        test('starts with a digit is invalid', () => {
            fail(minimal({ apiName: '1Component' }), 'invalid format');
        });

        test('contains a hyphen is invalid', () => {
            fail(minimal({ apiName: 'my-component' }), 'invalid format');
        });

        test('ends with underscore is invalid', () => {
            fail(minimal({ apiName: 'MyComponent_' }), 'invalid format');
        });

        test('contains double underscore is invalid', () => {
            fail(minimal({ apiName: 'My__Component' }), 'invalid format');
        });

        test('valid with underscores passes', () => {
            pass(minimal({ apiName: 'My_Component_1' }));
        });
    });

    // ---------------------------------------------------------------------------
    // ID auto-generation
    // ---------------------------------------------------------------------------

    describe('id auto-generation', () => {
        const UUID_RE =
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        test('component without id gets one assigned', () => {
            const out = pass(withComponent(baseComp('dcCard', 'dcCard1')));
            assert.match(out.value[0].id, UUID_RE);
        });

        test('existing valid UUID is preserved', () => {
            const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
            const out = pass(
                withComponent({ ...baseComp('dcCard', 'dcCard1'), id })
            );
            assert.equal(out.value[0].id, id);
        });

        test('query without id gets one assigned', () => {
            const out = pass(
                minimal({
                    queries: [
                        { apiName: 'getAccounts', objectApiName: 'Account' }
                    ]
                })
            );
            assert.match(out.queries[0].id, UUID_RE);
        });

        test('resource without id gets one assigned', () => {
            const out = pass(
                minimal({
                    resources: [
                        {
                            apiName: 'myConst',
                            description: 'A constant',
                            dataType: 'text',
                            defaultValue: 'hello',
                            type: 'constant'
                        }
                    ]
                })
            );
            assert.match(out.resources[0].id, UUID_RE);
        });
    });

    // ---------------------------------------------------------------------------
    // Component wrappers
    // ---------------------------------------------------------------------------

    describe('component wrappers', () => {
        test('missing name', () => {
            const { name: _, ...comp } = baseComp('dcCard', 'dcCard1');
            fail(withComponent(comp), 'missing required field "name"');
        });

        test('missing apiName', () => {
            const { apiName: _, ...comp } = baseComp('dcCard', 'dcCard1');
            fail(withComponent(comp), 'missing required field "apiName"');
        });

        test('missing value', () => {
            const { value: _, ...comp } = baseComp('dcCard', 'dcCard1');
            fail(withComponent(comp), 'missing required field "value"');
        });

        test('invalid component apiName format', () => {
            fail(
                withComponent(baseComp('dcCard', '1invalid')),
                'invalid format'
            );
        });

        test('duplicate component apiName across siblings', () => {
            fail(
                minimal({
                    value: [
                        baseComp('dcCard', 'dcCard1'),
                        baseComp('dcCard', 'dcCard1')
                    ]
                }),
                'Duplicate component apiName: "dcCard1"'
            );
        });

        test('duplicate component apiName across nested slots', () => {
            const inner = baseComp('dcCard', 'dcCard1');
            const outer = {
                ...baseComp('dcContainer', 'dcCard1'),
                slots: [{ name: 'content', components: [inner] }]
            };
            fail(
                withComponent(outer),
                'Duplicate component apiName: "dcCard1"'
            );
        });

        test('inlineStyle must be a string', () => {
            fail(
                withComponent(
                    baseComp('dcCard', 'dcCard1', { inlineStyle: 42 })
                ),
                'inlineStyle: must be a string'
            );
        });

        test('empty slots array is forbidden', () => {
            fail(
                withComponent({ ...baseComp('dcCard', 'dcCard1'), slots: [] }),
                'empty slots array is forbidden'
            );
        });

        test('slot missing name', () => {
            const comp = {
                ...baseComp('dcCard', 'dcCard1'),
                slots: [{ components: [] }]
            };
            fail(withComponent(comp), 'missing required field "name"');
        });

        test('slot components must be an array', () => {
            const comp = {
                ...baseComp('dcCard', 'dcCard1'),
                slots: [{ name: 'content', components: 'bad' }]
            };
            fail(withComponent(comp), 'must be an array');
        });
    });

    // ---------------------------------------------------------------------------
    // Visibility rules
    // ---------------------------------------------------------------------------

    describe('visibility rules', () => {
        function compWithVisibility(rule) {
            return withComponent(
                baseComp('dcCard', 'dcCard1', { visibilityRule: rule })
            );
        }

        test('valid simple visibility rule passes', () => {
            pass(
                compWithVisibility({
                    left: {
                        field: '{!Combo1.value}',
                        operator: 'eq',
                        value: 'yes'
                    }
                })
            );
        });

        test('missing left', () => {
            fail(compWithVisibility({}), 'missing required field "left"');
        });

        test('field not using {!...} syntax', () => {
            fail(
                compWithVisibility({
                    left: { field: 'noSyntax', operator: 'eq', value: 'x' }
                }),
                'must use {!...} syntax'
            );
        });

        test('invalid operator', () => {
            fail(
                compWithVisibility({
                    left: { field: '{!x}', operator: 'invalid', value: 'x' }
                }),
                'not in the allowed operator list'
            );
        });

        test('null operator with value present is forbidden', () => {
            fail(
                compWithVisibility({
                    left: { field: '{!x}', operator: 'null', value: 'x' }
                }),
                '"value" must be omitted when operator is "null"'
            );
        });

        test('notNull operator with value present is forbidden', () => {
            fail(
                compWithVisibility({
                    left: { field: '{!x}', operator: 'notNull', value: 'x' }
                }),
                '"value" must be omitted when operator is "notNull"'
            );
        });

        test('eq operator missing value', () => {
            fail(
                compWithVisibility({ left: { field: '{!x}', operator: 'eq' } }),
                '"value" is required for operator "eq"'
            );
        });

        test('invalid logicalOperator', () => {
            fail(
                compWithVisibility({
                    left: { field: '{!x}', operator: 'eq', value: 'a' },
                    logicalOperator: 'xor'
                }),
                'must be "and" or "or"'
            );
        });

        test('logicalOperator present but right missing', () => {
            fail(
                compWithVisibility({
                    left: { field: '{!x}', operator: 'eq', value: 'a' },
                    logicalOperator: 'and'
                }),
                '"right" is required when "logicalOperator" is present'
            );
        });

        test('valid compound visibility rule passes', () => {
            pass(
                compWithVisibility({
                    left: { field: '{!x}', operator: 'eq', value: 'a' },
                    logicalOperator: 'and',
                    right: { field: '{!y}', operator: 'null' }
                })
            );
        });
    });

    // ---------------------------------------------------------------------------
    // Component-specific: dcAccordion
    // ---------------------------------------------------------------------------

    describe('dcAccordion', () => {
        test('content slot with only dcAccordionSection passes', () => {
            pass(
                withComponent({
                    name: 'dcAccordion',
                    apiName: 'dcAccordion1',
                    value: {},
                    slots: [
                        {
                            name: 'content',
                            components: [
                                {
                                    name: 'dcAccordionSection',
                                    apiName: 'avdynamic-dc-accordionSectionA',
                                    value: {}
                                }
                            ]
                        }
                    ]
                })
            );
        });

        test('non-dcAccordionSection child in content slot', () => {
            fail(
                withComponent({
                    name: 'dcAccordion',
                    apiName: 'dcAccordion1',
                    value: {},
                    slots: [
                        {
                            name: 'content',
                            components: [baseComp('dcCard', 'dcCard1')]
                        }
                    ]
                }),
                'content slot only accepts dcAccordionSection'
            );
        });
    });

    // ---------------------------------------------------------------------------
    // Component-specific: dcAccordionSection
    // ---------------------------------------------------------------------------

    describe('dcAccordionSection', () => {
        test('dcAccordionSection outside dcAccordion', () => {
            fail(
                withComponent(
                    baseComp(
                        'dcAccordionSection',
                        'avdynamic-dc-accordionSuffix'
                    )
                ),
                'must be placed inside a dcAccordion slot'
            );
        });

        test('dcAccordionSection apiName missing prefix', () => {
            fail(
                withComponent({
                    name: 'dcAccordion',
                    apiName: 'dcAccordion1',
                    value: {},
                    slots: [
                        {
                            name: 'content',
                            components: [
                                baseComp('dcAccordionSection', 'wrongPrefix')
                            ]
                        }
                    ]
                }),
                'dcAccordionSection apiName must start with "avdynamic-dc-accordion"'
            );
        });

        test('dcAccordionSection apiName with no suffix after prefix', () => {
            fail(
                withComponent({
                    name: 'dcAccordion',
                    apiName: 'dcAccordion1',
                    value: {},
                    slots: [
                        {
                            name: 'content',
                            components: [
                                baseComp(
                                    'dcAccordionSection',
                                    'avdynamic-dc-accordion'
                                )
                            ]
                        }
                    ]
                }),
                'must include the sanitized item value after'
            );
        });
    });

    // ---------------------------------------------------------------------------
    // Component-specific: dcLayout / avonniLayoutItem
    // ---------------------------------------------------------------------------

    describe('dcLayout', () => {
        function layoutWithItems(items) {
            return withComponent({
                name: 'dcLayout',
                apiName: 'dcLayout1',
                value: {},
                slots: [
                    {
                        name: 'content',
                        components: items
                    }
                ]
            });
        }

        test('valid dcLayout with sequential avonniLayoutItems passes', () => {
            pass(
                layoutWithItems([
                    baseComp('avonniLayoutItem', 'avonniLayoutItem1'),
                    baseComp('avonniLayoutItem', 'avonniLayoutItem2')
                ])
            );
        });

        test('non-avonniLayoutItem child in content slot', () => {
            fail(
                layoutWithItems([baseComp('dcCard', 'dcCard1')]),
                'content slot only accepts avonniLayoutItem'
            );
        });

        test('avonniLayoutItem apiName not matching pattern', () => {
            fail(
                layoutWithItems([baseComp('avonniLayoutItem', 'wrongName1')]),
                'must follow pattern avonniLayoutItem{columnNumber}'
            );
        });

        test('avonniLayoutItem numbering not sequential', () => {
            fail(
                layoutWithItems([
                    baseComp('avonniLayoutItem', 'avonniLayoutItem1'),
                    baseComp('avonniLayoutItem', 'avonniLayoutItem3')
                ]),
                'numbering must be sequential starting at 1'
            );
        });

        test('avonniLayoutItem numbering not starting at 1', () => {
            fail(
                layoutWithItems([
                    baseComp('avonniLayoutItem', 'avonniLayoutItem2')
                ]),
                'numbering must be sequential starting at 1'
            );
        });
    });

    describe('avonniLayoutItem', () => {
        test('avonniLayoutItem outside dcLayout', () => {
            fail(
                withComponent(
                    baseComp('avonniLayoutItem', 'avonniLayoutItem1')
                ),
                'must be placed inside a dcLayout slot'
            );
        });
    });

    // ---------------------------------------------------------------------------
    // Component-specific: dcNavigationContainer
    // ---------------------------------------------------------------------------

    describe('dcNavigationContainer', () => {
        function navContainer(items, slotComponents) {
            return withComponent({
                name: 'dcNavigationContainer',
                apiName: 'dcNav1',
                value: { items },
                slots: [{ name: 'content', components: slotComponents }]
            });
        }

        test('valid dcNavigationContainer passes', () => {
            pass(
                navContainer(
                    [{ value: 'Tab1' }],
                    [
                        baseComp(
                            'dcContainer',
                            'avdynamic-dc-navigation-containerTab1'
                        )
                    ]
                )
            );
        });

        test('non-dcContainer in content slot', () => {
            fail(
                navContainer(
                    [{ value: 'Tab1' }],
                    [baseComp('dcCard', 'dcCard1')]
                ),
                'content slot only accepts dcContainer'
            );
        });

        test('missing dcContainer for an item', () => {
            fail(
                navContainer([{ value: 'Tab1' }], []),
                'missing dcContainer with apiName "avdynamic-dc-navigation-containerTab1"'
            );
        });

        test('dcContainer apiName not matching any item', () => {
            fail(
                navContainer(
                    [{ value: 'Tab1' }],
                    [
                        baseComp(
                            'dcContainer',
                            'avdynamic-dc-navigation-containerTab1'
                        ),
                        baseComp(
                            'dcContainer',
                            'avdynamic-dc-navigation-containerTab2'
                        )
                    ]
                ),
                'does not match any item value'
            );
        });

        test('item missing value field', () => {
            fail(navContainer([{}], []), 'missing required field "value"');
        });
    });

    // ---------------------------------------------------------------------------
    // Component-specific: dcTabbedContainer
    // ---------------------------------------------------------------------------

    describe('dcTabbedContainer', () => {
        test('valid dcTabbedContainer passes', () => {
            pass(
                withComponent({
                    name: 'dcTabbedContainer',
                    apiName: 'dcTabbed1',
                    value: { items: [{ value: 'Tab1' }] },
                    slots: [
                        {
                            name: 'content',
                            components: [
                                baseComp(
                                    'dcContainer',
                                    'avdynamic-dc-tabbed-containerTab1'
                                )
                            ]
                        }
                    ]
                })
            );
        });

        test('dcContainer apiName must use tabbed prefix', () => {
            fail(
                withComponent({
                    name: 'dcTabbedContainer',
                    apiName: 'dcTabbed1',
                    value: { items: [{ value: 'Tab1' }] },
                    slots: [
                        {
                            name: 'content',
                            components: [
                                baseComp(
                                    'dcContainer',
                                    'avdynamic-dc-navigation-containerTab1'
                                )
                            ]
                        }
                    ]
                }),
                'does not match any item value'
            );
        });
    });

    // ---------------------------------------------------------------------------
    // Component-specific: dcRepeatable
    // ---------------------------------------------------------------------------

    describe('dcRepeatable', () => {
        function repeatable(apiName, childValue) {
            return withComponent({
                name: 'dcRepeatable',
                apiName,
                value: {},
                slots: [
                    {
                        name: 'content',
                        components: [baseComp('dcCard', 'dcCard1', childValue)]
                    }
                ]
            });
        }

        test('correct CurrentRecord reference passes', () => {
            pass(
                repeatable('myRepeatable', {
                    label: '{!myRepeatable.CurrentRecord.Name}'
                })
            );
        });

        test('wrong apiName in CurrentRecord reference', () => {
            fail(
                repeatable('myRepeatable', {
                    label: '{!wrongName.CurrentRecord.Name}'
                }),
                'CurrentRecord reference "{!wrongName.CurrentRecord.Name}" uses "wrongName" but must use the dcRepeatable\'s apiName "myRepeatable"'
            );
        });
    });

    // ---------------------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------------------

    describe('queries', () => {
        function withQuery(q, extra = {}) {
            return minimal({ queries: [q], ...extra });
        }

        test('valid query passes', () => {
            pass(
                withQuery({ apiName: 'getAccounts', objectApiName: 'Account' })
            );
        });

        test('missing apiName', () => {
            fail(
                withQuery({ objectApiName: 'Account' }),
                'missing required field "apiName"'
            );
        });

        test('invalid query apiName format', () => {
            fail(
                withQuery({ apiName: '1bad', objectApiName: 'Account' }),
                'invalid format'
            );
        });

        test('duplicate query apiName', () => {
            fail(
                minimal({
                    queries: [
                        { apiName: 'q1', objectApiName: 'Account' },
                        { apiName: 'q1', objectApiName: 'Contact' }
                    ]
                }),
                'duplicate query apiName'
            );
        });

        test('neither objectApiName nor nestedQueries', () => {
            fail(
                withQuery({ apiName: 'q1' }),
                'must have either "objectApiName" or "nestedQueries"'
            );
        });

        test('both objectApiName and nestedQueries', () => {
            fail(
                withQuery({
                    apiName: 'q1',
                    objectApiName: 'Account',
                    nestedQueries: []
                }),
                'cannot have both "objectApiName" and "nestedQueries"'
            );
        });

        test('valid query with nestedQueries passes', () => {
            pass(
                withQuery({
                    apiName: 'q1',
                    nestedQueries: [{ objectApiName: 'Account' }]
                })
            );
        });

        describe('filter variables', () => {
            test('valid filter with variables passes', () => {
                pass(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariables: { name: 'Acme' },
                        filterVariablesTypes: { name: 'String' }
                    })
                );
            });

            test('filter not a string', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 42
                    }),
                    'filter: must be a string'
                );
            });

            test('filter has placeholders but filterVariables missing', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariablesTypes: { name: 'String' }
                    }),
                    '"filterVariables" is missing or invalid'
                );
            });

            test('filter has placeholders but filterVariablesTypes missing', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariables: { name: 'Acme' }
                    }),
                    '"filterVariablesTypes" is missing or invalid'
                );
            });

            test('filterVariables missing a placeholder key', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariables: {},
                        filterVariablesTypes: { name: 'String' }
                    }),
                    'filterVariables: missing key "name"'
                );
            });

            test('filterVariables has an extra key not in filter', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariables: { name: 'Acme', extra: 'x' },
                        filterVariablesTypes: { name: 'String' }
                    }),
                    'filterVariables: key "extra" is not referenced'
                );
            });

            test('filterVariablesTypes missing a placeholder key', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariables: { name: 'Acme' },
                        filterVariablesTypes: {}
                    }),
                    'filterVariablesTypes: missing key "name"'
                );
            });

            test('filterVariablesTypes has an extra key not in filter', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariables: { name: 'Acme' },
                        filterVariablesTypes: {
                            name: 'String',
                            extra: 'String'
                        }
                    }),
                    'filterVariablesTypes: key "extra" is not referenced'
                );
            });

            test('invalid type in filterVariablesTypes', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name = :name',
                        filterVariables: { name: 'Acme' },
                        filterVariablesTypes: { name: 'Text' }
                    }),
                    '"Text" is not a valid type'
                );
            });

            test('no placeholders but filterVariables has keys', () => {
                fail(
                    withQuery({
                        apiName: 'q1',
                        objectApiName: 'Account',
                        filter: 'Name != null',
                        filterVariables: { extra: 'x' },
                        filterVariablesTypes: {}
                    }),
                    '"filterVariables" has keys but filter contains no :placeholders'
                );
            });
        });
    });

    // ---------------------------------------------------------------------------
    // Query bindings in components
    // ---------------------------------------------------------------------------

    describe('query bindings', () => {
        const QUERY = { apiName: 'getAccounts', objectApiName: 'Account' };

        function compWithBinding(valueOverrides) {
            return minimal({
                queries: [QUERY],
                value: [
                    baseComp('dcDatatable', 'dcDatatable1', {
                        itemsTypeSelected: 'query',
                        ...valueOverrides
                    })
                ]
            });
        }

        test('valid query binding passes', () => {
            pass(
                compWithBinding({
                    itemsSObject: '{!$Query.getAccounts}',
                    itemsSObjectApiName: 'Account',
                    nbItems: '{!$Query.getAccounts.nbItems}'
                })
            );
        });

        test('itemsSObject wrong pattern', () => {
            fail(
                compWithBinding({ itemsSObject: 'getAccounts' }),
                'must match pattern {!$Query.<apiName>}'
            );
        });

        test('itemsSObject references non-existent query', () => {
            fail(
                compWithBinding({ itemsSObject: '{!$Query.nonExistent}' }),
                'references query "nonExistent" which does not exist'
            );
        });

        test('itemsSObjectApiName mismatch', () => {
            fail(
                compWithBinding({
                    itemsSObject: '{!$Query.getAccounts}',
                    itemsSObjectApiName: 'Contact'
                }),
                "does not match the referenced query's objectApiName"
            );
        });

        test('nbItems wrong pattern', () => {
            fail(
                compWithBinding({
                    itemsSObject: '{!$Query.getAccounts}',
                    nbItems: '{!$Query.getAccounts}'
                }),
                'must match pattern {!$Query.<apiName>.nbItems}'
            );
        });

        test('nbItems references non-existent query', () => {
            fail(
                compWithBinding({
                    itemsSObject: '{!$Query.getAccounts}',
                    nbItems: '{!$Query.nonExistent.nbItems}'
                }),
                'references query "nonExistent" which does not exist'
            );
        });
    });

    // ---------------------------------------------------------------------------
    // Resources
    // ---------------------------------------------------------------------------

    describe('resources', () => {
        function withResource(r) {
            return minimal({ resources: [r] });
        }

        describe('constant', () => {
            const VALID_CONST = {
                apiName: 'myConst',
                description: 'A constant',
                dataType: 'text',
                defaultValue: 'hello',
                type: 'constant'
            };

            test('valid constant passes', () => {
                pass(withResource(VALID_CONST));
            });

            test('missing apiName', () => {
                const { apiName: _, ...rest } = VALID_CONST;
                fail(withResource(rest), 'missing required field "apiName"');
            });

            test('duplicate resource apiName', () => {
                fail(
                    minimal({
                        resources: [
                            VALID_CONST,
                            { ...VALID_CONST, defaultValue: 'other' }
                        ]
                    }),
                    'duplicate resource apiName'
                );
            });

            test('missing description', () => {
                const { description: _, ...rest } = VALID_CONST;
                fail(
                    withResource(rest),
                    'missing required field "description"'
                );
            });

            test('missing dataType', () => {
                const { dataType: _, ...rest } = VALID_CONST;
                fail(withResource(rest), 'missing required field "dataType"');
            });

            test('missing defaultValue', () => {
                const { defaultValue: _, ...rest } = VALID_CONST;
                fail(
                    withResource(rest),
                    'constant is missing required field "defaultValue"'
                );
            });

            test('invalid dataType for constant', () => {
                fail(
                    withResource({ ...VALID_CONST, dataType: 'record' }),
                    'for constant, must be one of'
                );
            });
        });

        describe('formula', () => {
            const VALID_FORMULA = {
                apiName: 'myFormula',
                description: 'A formula',
                dataType: 'number',
                formula: 'TODAY()',
                type: 'formula'
            };

            test('valid formula passes', () => {
                pass(withResource(VALID_FORMULA));
            });

            test('missing formula field', () => {
                const { formula: _, ...rest } = VALID_FORMULA;
                fail(
                    withResource(rest),
                    'formula is missing required field "formula"'
                );
            });

            test('invalid dataType for formula', () => {
                fail(
                    withResource({ ...VALID_FORMULA, dataType: 'record' }),
                    'for formula, must be one of'
                );
            });
        });

        describe('variable', () => {
            const VALID_VAR = {
                apiName: 'myVar',
                description: 'A variable',
                dataType: 'record',
                type: 'variable'
            };

            test('valid variable passes', () => {
                pass(withResource(VALID_VAR));
            });

            test('invalid dataType for variable', () => {
                fail(
                    withResource({ ...VALID_VAR, dataType: 'unsupported' }),
                    'for variable, must be one of'
                );
            });

            test('availability not an array', () => {
                fail(
                    withResource({ ...VALID_VAR, availability: 'input' }),
                    'availability: must be an array'
                );
            });

            test('availability with invalid entry', () => {
                fail(
                    withResource({
                        ...VALID_VAR,
                        availability: ['input', 'bad']
                    }),
                    '"bad" is not valid. Allowed: "input", "output"'
                );
            });

            test('valid availability passes', () => {
                pass(
                    withResource({
                        ...VALID_VAR,
                        availability: ['input', 'output']
                    })
                );
            });
        });

        test('invalid resource type', () => {
            fail(
                withResource({
                    apiName: 'r1',
                    description: 'd',
                    dataType: 'text',
                    type: 'unknown'
                }),
                'must be one of constant, formula, variable'
            );
        });

        test('missing type', () => {
            fail(
                withResource({
                    apiName: 'r1',
                    description: 'd',
                    dataType: 'text'
                }),
                'missing required field "type"'
            );
        });
    });
});
