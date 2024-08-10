import { beforeAll, describe, expect, test } from "vitest";
import { EmptyFileSystem, type LangiumDocument } from "langium";
import { expandToString as s } from "langium/generate";
import { parseHelper } from "langium/test";
import { createSharcServices } from "../../src/language/sharc-module.js";
import { Attributes, Layout, Style, isLayout } from "../../src/language/generated/ast.js";

let services: ReturnType<typeof createSharcServices>;
let parse: ReturnType<typeof parseHelper<Layout>>;
let document: LangiumDocument<Layout> | undefined;

beforeAll(async () => {
    services = createSharcServices(EmptyFileSystem);
    parse = parseHelper<Layout>(services.Sharc);

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

const walkattrs = (attrs?: Attributes) => attrs?.attrs.map(a => `${a.name}: ${a.value}`).join(', ');
const walkstyles = (attrs?: Style) => attrs?.styles.map(a => `${a.name}: ${a.value}`).join(', ');

describe('Parsing tests', () => {

    test('parse simple model', async () => {
        document = await parse(`
            architecture "../../../larc/src/language/example.larc"

            include "foo"
            include "bar"

            style {
                architecture:title [
                    font-family Hasklig
                    font-size larger
                ]

                aws [
                    icon url("aws/group/AWS-Cloud_32.svg")
                    border-color black
                ]

                ecs [
                    border-style dashed
                    border-color orange
                    width 3
                    height 1
                ]
            }

            layout {
                // architecture is a special node derived from the architecture file above
                architecture:title [
                    position 0:-1
                ]

                aws:frankfurt [
                    position 0:0
                ]

                alb [
                    left anchor(ecr:center)
                ]

                ecr [
                    top anchor(ecr:top)
                    padding-left 40pt
                ]

                rds [
                    bottom anchor(ecr:bottom)
                    left anchor(ecr:right)
                ]

                efs [
                    left anchor(ecr:left)
                    top anchor(ecr:bottom)
                ]

                s3 [
                    right anchor(ecr:right)
                    top anchor(ecr:bottom)
                ]

                backup [
                    left anchor(ecr:left)
                    top anchor(efs:top)
                ]
            }
        `);

        // check for absensce of parser errors the classic way:
        //  deacivated, find a much more human readable way below!
        // expect(document.parseResult.parserErrors).toHaveLength(0);

        const doc = document.parseResult.value;
        expect(
            // here we use a (tagged) template expression to create a human readable representation
            //  of the AST part we are interested in and that is to be compared to our expectation;
            // prior to the tagged template expression we check for validity of the parsed document object
            //  by means of the reusable function 'checkDocumentValid()' to sort out (critical) typos first;
            checkDocumentValid(document) || s`
                ${doc?.architecture.location}
                Includes:
                  ${doc?.includes?.map(p => p.location)?.join('\n')}
                Styles:
                  ${doc?.styles?.flatMap(p => p.nodes).map(n => `${n.name}: ${walkstyles(n as Style)}`)?.join('\n')}
                Nodes:
                  ${doc?.nodes?.flatMap(p => p.nodes).map(n => `${n.name}: ${walkattrs(n as Attributes)}`)?.join('\n')}
            `
        ).toBe(s`
            ../../../larc/src/language/example.larc
            Includes:
              foo
              bar
            Styles:
              architecture:title: font-family: Hasklig, font-size: larger
              aws: icon: url("aws/group/AWS-Cloud_32.svg"), border-color: black
              ecs: border-style: dashed, border-color: orange, width: 3, height: 1
            Nodes:
              architecture:title: position: 0:-1
              aws:frankfurt: position: 0:0
              alb: left: anchor(ecr:center)
              ecr: top: anchor(ecr:top), padding-left: 40pt
              rds: bottom: anchor(ecr:bottom), left: anchor(ecr:right)
              efs: left: anchor(ecr:left), top: anchor(ecr:bottom)
              s3: right: anchor(ecr:right), top: anchor(ecr:bottom)
              backup: left: anchor(ecr:left), top: anchor(efs:top)        `);
    });
});

function checkDocumentValid(document: LangiumDocument): string | undefined {
    return document.parseResult.parserErrors.length && s`
        Parser errors:
          ${document.parseResult.parserErrors.map(e => e.message).join('\n  ')}
    `
        || document.parseResult.value === undefined && `ParseResult is 'undefined'.`
        || !isLayout(document.parseResult.value) && `Root AST object is a ${document.parseResult.value.$type}, expected a '${Model}'.`
        || undefined;
}
