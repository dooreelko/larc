import { Architecture, ArchNode, Model as ArcModel, Attribute } from '@larc/larc/model';
import type { ArcReference, Attributes, Layout } from '../language/generated/ast.js';
// import { expandToNode, toString } from 'langium/generate';

export type SharcModel = Layout & {
    architecture: ArcReference & {
        node: ArcModel
    }
};

export type LayoutNode = {
    name: string,
    kind: string,
    title?: string
};

export type KindPass = LayoutNode & {
    nodes: KindPass[]
};

export type SecondPass = LayoutNode & {
    width: number,
    height: number,
    nodes: SecondPass[]
};

export type Anchor = {
    id: string,
    ownSide: string,
    otherSide: string
};

export type XY = {
    x: number,
    y: number,
}

export type LocationAttrs = XY & { anchors: Anchor[] }

export type LayoutPass = LayoutNode & {
    width: number,
    height: number,
    laid: boolean,
    fixed: boolean, // laid: true, fixed: false means the node can still be swapped
    locationAttrs?: LocationAttrs,
    nodes: (LayoutPass | undefined)[][]
};

export const nodeAttr = (name: string, attrs: Attribute[], def: string, nodeName?: string) => {
    const res = (attrs ?? []).find(n => n.name === name);

    return res?.value ?? def;
};

const nodeKind = (node: ArchNode) => nodeAttr('kind', node.attrs?.attrs ?? [], node.name);

const gatherKind: (node: ArchNode) => KindPass = (node: ArchNode) => ({
    name: node.name,
    kind: nodeKind(node) as string,
    title: node.title,
    nodes: node.nodes.map(gatherKind)
});

const countDeep: (node: KindPass) => number = (node: KindPass) => (1 + node.nodes.flatMap(countDeep).reduce((sofar, curr) => sofar + curr, 0));

const isLaid = (node?: LayoutPass) => !node || node.laid;
const isFixed = (node?: LayoutPass) => !node || node.fixed;

const putNode = (node: LayoutPass, oldPos: XY, newPos: XY, nodes: (LayoutPass | undefined)[][]) => {
    const old = nodes[newPos.x][newPos.y];
    console.error(`Put ${node?.name} at (${newPos.x}:${newPos.y}), replacing: ${old?.name}`);

    if (isLaid(old) && isFixed(old)) {
        throw new Error(`Cannot place ${node.name} at ${newPos.x}:${newPos.y} since ${old?.name} is already fixed there.`);
    }

    node.fixed = true;
    node.laid = true;
    nodes[oldPos.x][oldPos.y] = old;
    nodes[newPos.x][newPos.y] = node;
};

const placeOneFixed = (nodes: (LayoutPass | undefined)[][]) => {
    for (let y = 0; y < nodes.length; y++) {
        for (let x = 0; x < nodes[y].length; x++) {
            const n = nodes[x][y];
            if (isLaid(n)) {
                continue;
            }

            if ((n?.locationAttrs?.anchors ?? []).length > 0) {
                continue;
            }

            const px = n?.locationAttrs?.x ?? -1;
            const py = n?.locationAttrs?.y ?? -1;

            console.error(`Position for ${n?.name}: (${px}:${py})`);

            if (px !== -1 && py !== -1) {
                putNode(n!, { x, y }, { x: px, y: py }, nodes);
                return;
            }

            if (px !== -1 && py === -1) {
                // console.error(`Got an explicit X position for ${n?.name}: (${n?.locationAttrs?.x}:${n?.locationAttrs?.y})`);
                const swaps = nodes.map(n => n[x]);
                const ny = swaps.findIndex(n => !isLaid(n));

                if (ny === -1) {
                    throw new Error(`Cannot place ${n?.name} somewhere at col ${px} - all occupied bz: ${swaps.map(n => n?.name).join(', ')}`)
                }

                putNode(n!, { x, y }, { x: px, y: ny }, nodes);
                return;
            }

            if (py !== -1 && px === -1) {
                const swaps = nodes[py];
                const nx = swaps.findIndex(n => !isLaid(n));

                if (nx === -1) {
                    throw new Error(`Cannot place ${n?.name} somewhere at row ${py} - all occupied bz: ${swaps.map(n => n?.name).join(', ')}`)
                }

                putNode(n!, { x, y }, { x: nx, y: py }, nodes);
                return;
            }

            // just leave it where it is
            console.error(`Pinning ${n?.name} ${JSON.stringify(n?.locationAttrs)} as is.`);
            n!.fixed = false;
            n!.laid = true;
            n!.locationAttrs = {
                anchors: n?.locationAttrs?.anchors ?? [],
                x, y
            }

        }
    }
};

const acnhorRE = /anchor\((?<id>[^:]+):(?<otherSide>[^:]+)\)/;
const parseArchor = (selfSide: string, val: string) => {
    const anchor = acnhorRE.exec(val);

    if (val && !anchor) {
        throw new Error(`${val} is not a valid anchor, expecting 'anchor(ID:side)'`)
    }

    return {
        ...(anchor?.groups as Anchor),
        selfSide
    }
}

const getLocationAttrs = (node?: Attributes) => {
    if (!node) {
        return;
    }

    return {
        x: parseInt(`${nodeAttr('x', node.attrs, '-1', node.name)}`),
        y: parseInt(`${nodeAttr('y', node.attrs, '-1', node.name)}`),

        anchors: ['left', 'right', 'top', 'bottom']
            .map(selfSide => ({ selfSide, val: nodeAttr(selfSide, node.attrs, '', node.name) as string }))
            .filter(anchor => !!anchor.val)
            .map(({ selfSide, val }) => parseArchor(selfSide, val))
    } as LocationAttrs;
}

const stringNodes = (nn: (LayoutPass | undefined)[][]) =>
    nn
        .filter(row => row.some(n => !!n))
        .map(row => row.map(n => `${n?.name}(${n?.locationAttrs?.x}:${n?.locationAttrs?.y})[${n?.laid}]`).join('\t')).join('\n');

const firstUnlaid = (nodes: (LayoutPass | undefined)[][]) => nodes
    .flat()
    .filter(n => !!n)
    .filter(n => !!n?.locationAttrs)
    .filter(n => n?.locationAttrs?.anchors.length === 0)
    .find(n => !n?.laid);

export function fixedPass(model: SharcModel) {
    const arc = model.architecture.node as Architecture;

    const kinded = arc.nodes.map(gatherKind);

    const gatherDepth: (node: KindPass) => SecondPass = (node: KindPass) => ({
        name: node.name,
        kind: node.kind,
        title: node.title,

        // as the first we assume a max possible square field
        width: node.nodes.map(countDeep).reduce((sofar, curr) => sofar + curr, 0),
        height: node.nodes.map(countDeep).reduce((sofar, curr) => sofar + curr, 0),
        nodes: node.nodes.map(gatherDepth)
    });

    const allNodes = model.nodes.flatMap(n => n.nodes).reduce((sofar, curr) => ({
        ...sofar,
        [curr.name]: curr as Attributes
    }), {} as Record<string, Attributes>);


    const layNodes: (node: SecondPass) => LayoutPass = (node: SecondPass) => {
        const nodes = Array.from(Array(node.width), (_, idx) => idx === 0 ? node.nodes.map(layNodes) : new Array(node.width)) as (LayoutPass | undefined)[][];

        const result = {
            name: node.name,
            kind: node.kind,
            title: node.title,
            laid: false,
            fixed: false,
            locationAttrs: getLocationAttrs(allNodes[node.name]),

            width: (nodes[0] ?? []).length,
            height: nodes.length,
        };


        let maxTries = node.width * node.height;
        console.error(`Laying ${node.name} ${maxTries}`);

        console.error(stringNodes(nodes));
        while (maxTries > 0 && !!firstUnlaid(nodes)) {
            placeOneFixed(nodes);
            console.error(stringNodes(nodes));

            --maxTries;
        }

        const firstBad = firstUnlaid(nodes);

        if (!!firstBad) {
            throw new Error(`Couldn't lay at least ${firstBad.name} with ${JSON.stringify(firstBad.locationAttrs)}, here's what came out:
                ${stringNodes(nodes)}`)
        }

        const fixed = nodes
            .filter(row => row.some(n => !!n))
            .map((row, y) => row.map((n, x) => n && !n.locationAttrs ? {
                ...n,
                locationAttrs: { x, y, anchors: [] },
                laid: true,
                fixed: false
            } : n));

        const trimLeft = fixed.map(r => r.findIndex(n => !!n)).sort()[0]

        const leftTrimmed = fixed.map(row => row.slice(trimLeft));

        const trimRight = leftTrimmed.map(r => r.findLastIndex(n => !!n)).sort().slice(-1)[0];

        const rightTrimmed = fixed.map(row => row.slice(0, trimRight + 1));

        console.error(`DONE Laying ${node.name}`);
        console.error(stringNodes(rightTrimmed));
        return {
            ...result,
            width: rightTrimmed.length ? rightTrimmed[0].length : 0,
            height: rightTrimmed.length,
            nodes: rightTrimmed
        };
    };

    const secondPass = kinded.map(gatherDepth);
    return layNodes({
        name: 'root',
        kind: 'root',
        width: secondPass.length,
        height: secondPass.length,
        nodes: secondPass
    })

}
export function generateHtml(model: SharcModel) {

    return JSON.stringify(fixedPass(model), null, 2);

    // const numRows = 5;
    // const numCols = 5;


    // const attr = (name: string, attr: string, def?: string) => {
    //     const node = allNodes.find(n => n.name === name);

    //     if (!node) {
    //         throw new Error(`Node ${name} not found among layout elements`);
    //     }

    //     const res = (node as Attributes).attrs.find(n => n.name === attr);

    //     if (!res && !def) {
    //         throw new Error(`Attribute ${attr} not found for ${name} and no default provided`);
    //     }

    //     return res?.value ?? def;
    // }

    // const x = (xy: string) => {
    //     const pair = xy.split(':');
    //     if (pair.length !== 2) {
    //         throw new Error(`Expected num:num for position, got ${xy}`)
    //     }

    //     return pair[0];
    // }

    // const y = (xy: string) => {
    //     const pair = xy.split(':');
    //     if (pair.length !== 2) {
    //         throw new Error(`Expected num:num for position, got ${xy}`)
    //     }

    //     return pair[1];
    // }

    // const fileNode = expandToNode`
    //     <html>
    //     <head>
    //         <title>
    //             ${arc.title}
    //         </title>
    //         <style>
    //             .parent {
    //                 display: grid;
    //                 grid-template-columns: repeat(${numCols}, 1fr);
    //                 grid-template-rows: repeat(${numRows}, 1fr);
    //                 gap: 8px;
    //             }

    //             .title {
    //                 grid-column-start: ${attr('architecture.title', 'x', '0')};
    //                 grid-row-start: ${attr('architecture.title', 'y', '0')};
    //                 grid-column: span 5 / span 5;
    //             }

    //             .main {
    //                 grid-column: span 5 / span 5;
    //                 grid-row: span 4 / span 4;
    //                 grid-row-start: 2;
    //             }
    //         </style>
    //     </head>
    //     <body>
    //         <div class="parent">
    //             <div class="title">${arc.title}</div>
    //             <div class="main">

    //                 <div class="diagram">
    //                     <div class="main">

    //                     </div>
    //                 </div>


    //             </div>
    //         </div>
    //     </body>
    //     </html>
    // `;
    // // const fileNode = expandToNode`
    // //     "use strict";

    // //     ${joinToNode(model.greetings, greeting => `console.log('Hello, ${greeting.person.ref?.name}!');`, { appendNewLineIfNotEmpty: true })}
    // // `.appendNewLineIfNotEmpty();

    // return toString(fileNode);
}
