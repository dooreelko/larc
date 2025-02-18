import { stringify } from 'yaml';
import { LayoutPass, SharcModel } from '../typing.js';
import { absPositions, debug, fixedPass, relativePass } from '../common/layout.js';
import { Architecture, Relations } from '@larc/larc/model';
import { kindToType } from './knowns.js';

type DacNode = {
    Type: string,
    Tite?: string,
    Direction?: string,
    Children: string[]
};

export function generateAwsDac(model: SharcModel) {
    const tree = relativePass(fixedPass(model));
    const abses = absPositions(tree);

    const root = tree.nodes[0][0]!; // TODO

    debug(JSON.stringify(root, null, 2));
    debug(JSON.stringify(abses, null, 2));

    const arc = model.architecture.node as Architecture;
    const rels = model.architecture.node as Relations;

    // const styleMap = model.styles
    //     .flatMap(ss => ss.nodes)
    //     .map(ss => ({
    //         [ss.name]: ss.styles.reduce((sofar, curr) => ({
    //             ...sofar,
    //             [curr.name]: curr.value
    //         }), {} as Record<string, string>)
    //     }))
    //     .reduce((sofar, curr) => ({
    //         ...sofar,
    //         ...curr
    //     }), {});

    // debug(JSON.stringify(styleMap, null, 2));

    const isDummy = (node: LayoutPass) => node.kind === '##dummy##';

    const walkNodes: (node: LayoutPass) => Record<string, DacNode>[] = (node: LayoutPass) => [
        {
            [node.name]: {
                Type: kindToType(node.name),
                Direction: 'vertical',
                Title: isDummy(node) ? '' : node.title ?? node.name,
                Children: node.nodes
                    .map((_, idx) => `${node.name}-row-${idx}`)
            }
        },
        ...node.nodes
            .map((row, idx) => ({
                [`${node.name}-row-${idx}`]: {
                    Type: 'AWS::Diagram::HorizontalStack',
                    Direction: 'horizontal',
                    Children: row
                        .map((n, col) => n?.name ?? `${node.name}-row-${idx}-dummy-${col}`)
                }
            })),
        ...node.nodes
            .map((row, idx) => row.map((n, col) => ({
                name: `${node.name}-row-${idx}-dummy-${col}`,
                kind: '##dummy##',
                width: 0,
                height: 0,
                laid: true,
                fixed: true,
                nodes: [],
                ...n
            })))
            .flat()
            .map(n => walkNodes(n!)).flat()
    ];

    const res = {
        Diagram: {
            DefinitionFiles: [{
                Type: 'URL',
                Url: 'https://raw.githubusercontent.com/awslabs/diagram-as-code/main/definitions/definition-for-aws-icons-light.yaml'
            }],
            Resources: {
                Canvas: {
                    Type: 'AWS::Diagram::Canvas',
                    Children: ['##main']
                },
                '##main': {
                    Type: 'AWS::Diagram::Resource',
                    Title: arc.title,
                    Preset: 'BlankGroup',
                    //TODO Font: (styleMap['architecture:title'] ?? {})['font-family'],
                    Border: 'rgba(255,255,255,255)',
                    Children: [root.name]
                },

                ...walkNodes(root)
                    .reduce((sofar, curr) => ({
                        ...sofar,
                        ...curr
                    }), {})
            },
            Links: rels.rels.map(rel => ({
                Source: rel.from.ref?.name,
                SourcePosition: 'E',
                Target: rel.to.ref?.name,
                TargetPosition: abses[rel.from.ref?.name ?? '']?.x < abses[rel.to.ref?.name ?? '']?.x ? 'W' : 'E',
                TargetArrowHead: {
                    Type: 'Open'
                },
                Type: 'orthogonal'
            }))
        }
    };

    return stringify(res);
}