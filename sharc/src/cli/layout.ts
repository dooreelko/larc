import chalk from 'chalk';
import { Architecture, ArchNode, Attribute } from '@larc/larc/model';
import type { Attributes } from '../language/generated/ast.js';
import { KindPass, LayoutPass, XY, Anchor, LocationAttrs, SharcModel, SecondPass } from './typing.js';

export const debug = (...args: unknown[]) => console.error(chalk.gray(args));

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

const isLaid = (node?: LayoutPass) => node?.laid;
const isFixed = (node?: LayoutPass) => node?.fixed;

const putNode = (node: LayoutPass, oldPos: XY, newPos: XY, nodes: (LayoutPass | undefined)[][]) => {
    const old = nodes[newPos.y][newPos.x];
    debug(`Put ${node?.name} at (${newPos.x}:${newPos.y}), replacing: ${old?.name}`);

    if (isLaid(old) && isFixed(old)) {
        throw new Error(`Cannot place ${node.name} at ${newPos.x}:${newPos.y} since ${old?.name} is already fixed there.`);
    }

    node.fixed = true;
    node.laid = true;
    nodes[oldPos.y][oldPos.x] = old;
    nodes[newPos.y][newPos.x] = node;

    node.locationAttrs = {
        ...node.locationAttrs!,
        ...newPos
    }

    if (old) {
        old.locationAttrs = {
            ...old.locationAttrs!,
            ...oldPos
        }
    }
};

const placeOneFixed = (nodes: (LayoutPass | undefined)[][]) => {
    for (let y = 0; y < nodes.length; y++) {
        for (let x = 0; x < nodes[y].length; x++) {
            const n = nodes[y][x];
            if (isLaid(n)) {
                debug(`${n?.name} is already laid`);
                continue;
            }

            const px = n?.locationAttrs?.x ?? -1;
            const py = n?.locationAttrs?.y ?? -1;

            debug(`Position for ${n?.name}: (${px}:${py})`);

            if (px !== -1 && py !== -1) {
                putNode(n!, { x, y }, { x: px, y: py }, nodes);
                return;
            }

            if (px !== -1 && py === -1) {
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

            if ((n?.locationAttrs?.anchors ?? []).length > 0) {
                debug(`${n?.name} has anchors. skipping for now`); // TODO
                continue;
            }

            // just leave it where it is
            debug(`Pinning ${n?.name} ${JSON.stringify(n?.locationAttrs)} as is at ${x}:${y}.`);
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

    const res = {
        x: parseInt(`${nodeAttr('x', node.attrs, '-1', node.name)}`),
        y: parseInt(`${nodeAttr('y', node.attrs, '-1', node.name)}`),

        anchors: ['left', 'right', 'top', 'bottom']
            .map(selfSide => ({ selfSide, val: nodeAttr(selfSide, node.attrs, '', node.name) as string }))
            .filter(anchor => !!anchor.val)
            .map(({ selfSide, val }) => parseArchor(selfSide, val))
    } as LocationAttrs;

    debug(`${node.name} ${JSON.stringify(res)}`)

    return res;
}

const stringNodes = (nn: (LayoutPass | undefined)[][]) =>
    nn
        .filter(row => row.some(n => !!n))
        .map(row => row.map(n => `${n?.name}(${n?.locationAttrs?.x}:${n?.locationAttrs?.y})[${n?.laid}]`).join('\t')).join('\n');

const firstUnlaid = (nodes: (LayoutPass | undefined)[][]) => nodes
    .flat()
    .filter(n => !!n)
    .filter(n => !!n?.locationAttrs)
    .filter(n => n?.locationAttrs?.anchors?.length === 0)
    .find(n => !n?.laid);

const getNames: (node: ArchNode) => string[] = (node: ArchNode) => [node.name, ...node.nodes.flatMap(getNames)];

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

    {
        // TODO: this needs to be a validation check post parsing
        const knownArcNodes = Object.fromEntries(arc.nodes.flatMap(getNames).map(e => [e, true]));

        const badArchRefs = model.nodes.flatMap(n => n.nodes).filter(n => !knownArcNodes[n.name]).map(n => n.name);

        if (badArchRefs.length) {
            console.error(chalk.red(`WARNING. These layout nodes have no architecture counterparts: ${badArchRefs.join(', ')}`));
        }
    }

    const layoutAttributes = model.nodes.flatMap(n => n.nodes).reduce((sofar, curr) => ({
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
            locationAttrs: getLocationAttrs(layoutAttributes[node.name]),
            foo: undefined,

            width: (nodes[0] ?? []).length,
            height: nodes.length,
            nodes: []
        } as LayoutPass;


        let maxTries = node.width * node.height;
        debug(`Laying ${node.name} ${maxTries}`);

        debug(stringNodes(nodes));
        while (maxTries > 0 && !!firstUnlaid(nodes)) {
            placeOneFixed(nodes);
            debug(stringNodes(nodes));

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
                locationAttrs: {
                    anchors: [],
                    x, y
                },
                laid: true,
                fixed: false
            } : n));

        const trimLeft = fixed.map(r => r.findIndex(n => !!n)).sort()[0]

        const leftTrimmed = fixed.map(row => row.slice(trimLeft));

        const trimRight = leftTrimmed.map(r => r.findLastIndex(n => !!n)).sort().slice(-1)[0];

        const rightTrimmed = fixed.map(row => row.slice(0, trimRight + 1));

        debug(`DONE Laying ${node.name}`);
        debug(stringNodes(rightTrimmed));
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