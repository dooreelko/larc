import { afterEach, beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { clearDocuments, parseHelper } from "langium/test";
import { createLarcServices } from "../../src/language/larc-module.js";
import { Model, Relations, isModel } from "../../src/language/generated/ast.js";

let services: ReturnType<typeof createLarcServices>;
let parse: ReturnType<typeof parseHelper<Model>>;
let document: LangiumDocument<Model> | undefined;

beforeAll(async () => {
    services = createLarcServices(EmptyFileSystem);
    parse = parseHelper<Model>(services.Larc);

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

afterEach(async () => {
    document && clearDocuments(services.shared, [document]);
});

describe('Linking tests', () => {

    test('linking of greetings', async () => {
        document = await parse(`
            architecture "My arc" {
                n1 "node 1" {
                    n3
                }
                n2
            }
            relations {
                n1 -> n2
                n3 <- n2
                n1 -> nonode
            }
        `);

        const rel = document.parseResult.value as Relations;

        expect(
            // here we first check for validity of the parsed document object by means of the reusable function
            //  'checkDocumentValid()' to sort out (critical) typos first,
            // and then evaluate the cross references we're interested in by checking
            //  the referenced AST element as well as for a potential error message;
            checkDocumentValid(document) || s`
                ${rel.rels.map(r => `${r.from.ref?.name || r.from.error?.message} || ${r.to.ref?.name || r.to.error?.message}`).join('\n')}
            `
        ).toBe(s`
            n1 || n2
            n3 || n2
            n1 || Could not resolve reference to ArchNode named 'nonode'.
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
