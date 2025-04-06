import { stringify } from 'yaml';
import { Model as Larc } from '@larc/larc/model';
import { Sharc } from '../../language/generated/ast.js';
import { LayoutNodeLight } from '../typing.js';
import { absPositions, debug, initLayoutTree, relativePass } from '../common/layout.js';
import { Architecture, Relations } from '@larc/larc/model';
import { kindToType } from './knowns.js';
import { Sparse2D } from '../common/sparsely.js';

type DacNode = {
    Type: string,
    Title?: string,
    Direction?: string,
    Children: string[]
};
export function generateAwsDac(layout: Sharc, larc: Larc) {

    const tree = relativePass(layout, initLayoutTree(layout, larc));

    const abses = absPositions(tree);

    const root = tree.nodes[0]!; // TODO

    // debug(JSON.stringify(root, null, 2));
    // debug(JSON.stringify(abses, null, 2));

    const arc = larc as Architecture;
    const rels = larc as Relations;

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

    const isDummy = (node: LayoutNodeLight) => node.kind === '##dummy##';

    const walkNodes: (node: LayoutNodeLight & { grid: Sparse2D<LayoutNodeLight> }) => Record<string, DacNode>[] = (node: LayoutNodeLight & { grid: Sparse2D<LayoutNodeLight> }) => [
        {
            [node.name]: {
                Type: kindToType(node.name),
                Direction: 'vertical',
                Title: isDummy(node) ? '' : node.title ?? node.name,
                Children: node.grid.toArray()
                    .map((_, idx) => `${node.name}-row-${idx}`)
            }
        },
        ...node.grid.toArray()
            .map((row, idx) => ({
                [`${node.name}-row-${idx}`]: {
                    Type: 'AWS::Diagram::HorizontalStack',
                    // Align: 'top',
                    Direction: 'horizontal',
                    Children: row
                        .map((n, col) => n?.name ?? `${node.name}-row-${idx}-dummy-${col}`)
                }
            })),
        ...node.grid.toArray()
            .map((row, idx) => row.map((n, col) => ({
                name: `${node.name}-row-${idx}-dummy-${col}`,
                kind: '##dummy##',
                width: 0,
                height: 0,
                x: 0,
                y: 0,
                nodes: [],
                ...n
            })))
            .flat()
            .map(n => walkNodes({
                ...n,
                grid: flatToGrid(n.nodes)
            })).flat()
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

                ...walkNodes({
                    ...root,
                    grid: flatToGrid(root.nodes)
                })
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

function flatToGrid(nodes: LayoutNodeLight[]) {
    const grid = new Sparse2D<LayoutNodeLight>();

    nodes.forEach(n => {
        grid.put(n, n.x, n.y);
    });

    grid.toArray().forEach(row => {
        debug(...row.map(n => !!n ? `${n?.name}[${n?.x},${n?.y}]` : '-'));
    });

    return grid;
}
