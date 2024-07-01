import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import { createLarcServices } from "../../src/language/larc-module.js";
import { Architecture, Attributes, Model, Relations, isModel } from "../../src/language/generated/ast.js";

let services: ReturnType<typeof createLarcServices>;
let parse: ReturnType<typeof parseHelper<Model>>;
let document: LangiumDocument<Model> | undefined;

beforeAll(async () => {
    services = createLarcServices(EmptyFileSystem);
    parse = parseHelper<Model>(services.Larc);

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

const walkattrs = (attrs?: Attributes) => attrs?.attrs.map(a => `${a.name}: ${a.value}`).join(', ');

describe('Parsing tests', () => {

    test('parse simple model', async () => {
        document = await parse(`
            architecture "My arc" {
                [
                    a1 v1
                    a2 "some thing"
                ]
                
                foo
                bar "Le bar" {
                    barbar
                }
                baz {[]}
                moot {
                    [ 
                        woo hoo
                        moo 42 
                    ]

                    woot
                }
            }
 
            relations {
                foo -> bar
                bar <= baz [ why not ]
                barbar <:> moot
                foo -- nonode
            }
        `);

        // check for absensce of parser errors the classic way:
        //  deacivated, find a much more human readable way below!
        // expect(document.parseResult.parserErrors).toHaveLength(0);

        const arc = document.parseResult.value as Architecture;
        const rel = document.parseResult.value as Relations;
        expect(
            // here we use a (tagged) template expression to create a human readable representation
            //  of the AST part we are interested in and that is to be compared to our expectation;
            // prior to the tagged template expression we check for validity of the parsed document object
            //  by means of the reusable function 'checkDocumentValid()' to sort out (critical) typos first;
            checkDocumentValid(document) || s`
                arc (${arc.title}):
                    [ ${walkattrs(arc.attrs)} ]
                    ${arc.nodes.map(a => `${a.name}:'${a.title ?? ''}' [${walkattrs(a.attrs)}] depth: ${a.nodes.length ?? 0}`)?.join('\n')}
                rels:
                    ${rel.rels?.map(r => `${r.from.$refText} (${r.rel}) ${r.to.$refText} [ ${walkattrs(r.attrs)} ]`)?.join('\n')}
            `
        ).toBe(s`
            arc (My arc):
                [ a1: v1, a2: some thing ] 
                foo:'' [undefined] depth: 0
                bar:'Le bar' [undefined] depth: 1
                baz:'' [] depth: 0
                moot:'' [woo: hoo, moo: 42] depth: 1
            rels:
                foo (->) bar [ undefined ]
                bar (<=) baz [ why: not ]
                barbar (<:>) moot [ undefined ]
                foo (--) nonode [ undefined ]
        `);
    });
});

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isModel(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected a '${Model}'.`
        || undefined;
}
