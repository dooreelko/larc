import chalk from 'chalk';
import { Architecture, ArchNode, Attribute } from '@larc/larc/model';
import type { Attributes } from '../../language/generated/ast.js';
import { KindPass, LayoutPass, XY, Anchor, LocationAttrs, SharcModel, SecondPass, NestedXY } from '../typing.js';
import { Sparse2D } from './sparsely.js';

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

const isLaid = (node?: LayoutPass) => !!node?.laid;
const isFixed = (node?: LayoutPass) => !!node?.fixed;

const putNode = (node: LayoutPass, oldPos: XY, newPos: XY, nodes: Sparse2D<LayoutPass>) => {
    const wasHereBefore = nodes.get(newPos.x, newPos.y);
    debug(`Put ${node?.name} at (${newPos.x}:${newPos.y}), replacing: ${wasHereBefore?.name}`);

    if (isLaid(wasHereBefore) && isFixed(wasHereBefore)) {
        throw new Error(`Cannot place ${node.name} at ${newPos.x}:${newPos.y} since ${wasHereBefore?.name} from ${oldPos.x}:${oldPos.y} is already fixed there.`);
    }

    node.fixed = true;
    node.laid = true;
    nodes.delete(oldPos.x, oldPos.y);
    nodes.put(node, newPos.x, newPos.y);
    nodes.put(wasHereBefore, oldPos.x, oldPos.y);

    node.locationAttrs = {
        ...node.locationAttrs!,
        ...newPos
    }

    if (wasHereBefore) {
        wasHereBefore.locationAttrs = {
            ...wasHereBefore.locationAttrs!,
            ...oldPos
        }
    }
};

const placeOneFixed = (nodes: Sparse2D<LayoutPass>) => {
    for (const [{ x, y }, n] of nodes.unorderedList()) {
        if (!n) {
            continue;
        }

        if (isLaid(n)) {
            debug(`${n?.name} is already laid`);
            continue;
        }

        const px = n.locationAttrs?.x ?? -1;
        const py = n.locationAttrs?.y ?? -1;

        debug(`Position for ${n?.name}: (${px}:${py})`);

        if (px !== -1 && py !== -1) {
            putNode(n, { x, y }, { x: px, y: py }, nodes);
            return;
        }

        if (px !== -1 && py === -1) {
            const swaps = nodes.toArray().map(n => n[x]);
            const ny = swaps.findIndex(n => !isLaid(n));

            if (ny === -1) {
                putNode(n!, { x, y }, { x: px, y: nodes.dims().maxy + 1 }, nodes);
                return;
            }

            putNode(n!, { x, y }, { x: px, y: ny }, nodes);
            return;
        }

        if (py !== -1 && px === -1) {
            const swaps = nodes.toArray()[py];
            const nx = swaps.findIndex(n => !isLaid(n));

            if (nx === -1) {
                putNode(n!, { x, y }, { x: nodes.dims().maxx + 1, y: py }, nodes);
                return;
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
};

const acnhorRE = /anchor\((?<otherId>[^:]+):(?<otherSide>[^:]+)\)/;
const parseArchor = (ownDirection: string, val: string) => {
    const anchor = acnhorRE.exec(val);

    if (val && !anchor) {
        throw new Error(`${val} is not a valid anchor, expecting 'anchor(ID:side)'`)
    }

    return {
        ...(anchor?.groups as unknown as Anchor),
        resolved: false,
        ownDirection
    }
}

const getLocationAttrs = (node: Attributes | undefined, xPos: number, yPos: number) => {
    if (!node) {
        return { x: xPos, y: yPos, anchors: [] };
    }

    const res = {
        x: parseInt(`${nodeAttr('x', node.attrs, `${xPos}`, node.name)}`),
        y: parseInt(`${nodeAttr('y', node.attrs, `${yPos}`, node.name)}`),

        anchors: ['left', 'right', 'top', 'bottom']
            .map(selfSide => ({ selfSide, val: nodeAttr(selfSide, node.attrs, '', node.name) as string }))
            .filter(anchor => !!anchor.val)
            .map(({ selfSide, val }) => parseArchor(selfSide, val))
    } as LocationAttrs;

    return res;
}

const stringNodes = (nn: (LayoutPass | undefined)[][]) =>
    nn
        // .filter(row => row.some(n => !!n))
        .map(row => row.map(n => !!n ? `${n?.name}(${n?.locationAttrs?.x}:${n?.locationAttrs?.y})[${n?.laid}]` : `[__]`).join('\t') + row.length).join('__\n');

const firstUnlaid = (nodes: Sparse2D<LayoutPass>) => nodes
    .unorderedList()
    .map(([_, el]) => el)
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


    const layNodes: (node: SecondPass, xPos: number, yPos: number) => LayoutPass = (node: SecondPass, xPos: number, yPos: number) => {
        const nodes = Sparse2D.from(node.nodes.map((n, idx) => [layNodes(n, 0, idx)]));

        const result = {
            name: node.name,
            kind: node.kind,
            title: node.title,
            laid: false,
            fixed: false,
            locationAttrs: getLocationAttrs(layoutAttributes[node.name], xPos, yPos),
            foo: undefined,

            width: nodes.width,
            height: nodes.height,
            nodes: []
        } as LayoutPass;


        let maxTries = node.width * node.height;
        debug(`Laying ${node.name} ${maxTries}`);

        debug(stringNodes(nodes.toArray()));
        while (maxTries > 0 && !!firstUnlaid(nodes)) {
            placeOneFixed(nodes);
            debug(stringNodes(nodes.toArray()));

            --maxTries;
        }

        const firstBad = firstUnlaid(nodes);

        if (!!firstBad) {
            throw new Error(`Couldn't lay at least ${firstBad.name} with ${JSON.stringify(firstBad.locationAttrs)}, here's what came out:
                ${stringNodes(nodes.toArray())}`)
        }

        return {
            ...result,
            width: nodes.width,
            height: nodes.height,
            nodes: nodes.toArray().map((row, y) => row.map((n, x) => (!n ? undefined : {
                ...n,
                locationAttrs: {
                    anchors: n.locationAttrs?.anchors || [],
                    x,
                    y
                }
            })))
        };
    };

    const secondPass = kinded.map(gatherDepth);
    const result = layNodes({
        name: 'root',
        kind: 'root',
        width: secondPass.length,
        height: secondPass.length,
        nodes: secondPass
    }, 0, 0);

    debug(`DONE Fixed PASS`);
    debug(stringNodes(result.nodes));

    return result;
}

const flatNodes: (node: LayoutPass) => LayoutPass[] = (node: LayoutPass) => [node, ...(node.nodes ?? []).flat().filter(n => !!n).flatMap(n => flatNodes(n!))];

export const isAnchored = (node: LayoutPass) => !!node.locationAttrs?.anchors.length;

const findParent = (name: string, allNodes: { node: LayoutPass, laid: boolean }[]) => {
    const parent = allNodes.find(n => n.node.nodes.flat().some(nn => nn?.name === name));

    if (!parent) {
        throw new Error(`Node ${name} doesn't seem to be in the node tree. A typo?`)
    }

    return parent.node;
}

export const applyAnchor = (node: LayoutPass, parent: LayoutPass, anchor: Anchor & { otherParent?: LayoutPass, otherNode?: LayoutPass }) => {
    if (!parent || !anchor?.otherParent) {
        throw new Error(`For node ${node.name} either parent (${parent?.name}) or anchor parent (${anchor.otherParent}) are missing. It's a bug.`);
    }

    if (parent.name !== anchor.otherParent.name) {
        // TODO
        throw new Error(`Anchoring achross different parents is not yet supported. ${parent.name}:${node.name} ==> ${anchor.otherParent.name}:${anchor.otherNode?.name}`);
    }

    const directions = {
        'left': { dx: -1, dy: 0 },
        'right': { dx: 1, dy: 0 },
        'top': { dx: 0, dy: -1 },
        'bottom': { dx: 0, dy: 1 },
    };

    const { dx, dy } = directions[anchor.ownDirection];

    // TODO: this effectively ignores any previous anchors, somehow we need
    // to find the starting position that is commonly acceptable for all anchored nodes
    const { x, y } = anchor.otherNode?.locationAttrs!;

    let step = 1;

    do {
        debug(`${node.name} step ${step}`);
        debug(`before\n`, stringNodes(parent.nodes));

        const sparseNodes = Sparse2D.from(parent.nodes);
        const newx = x + dx * step;
        const newy = y + dy * step;

        const old = sparseNodes.get(newx, newy);

        if (!isFixed(old)) {
            putNode(node, node.locationAttrs!, { x: newx, y: newy }, sparseNodes);
            const selfAnchor = node.locationAttrs?.anchors.find(a => a.ownDirection === anchor.ownDirection && a.otherId === anchor.otherId);
            selfAnchor!.resolved = true;

            parent.nodes = sparseNodes.toArray().map((row, y) => row.map((n, x) => (!n ? undefined : {
                ...n,
                locationAttrs: {
                    anchors: n.locationAttrs?.anchors || [],
                    x,
                    y
                }
            })));
            debug(`anchored\n`, stringNodes(parent.nodes));
            return true;
        } else {
            debug(`cannot place ${node.name} at ${newx}:${newy} - occpuied by ${old?.name} ${isLaid(old)} ${isFixed(old)}`);
        }

        ++step;

    } while (true);
};

export const relativePass = (tree: ReturnType<typeof fixedPass>) => {
    let pass = 0;
    do {
        ++pass;
        debug(`pass ${pass}`);

        const allNodes = flatNodes(tree)
            .map(n => ({
                node: n,
                laid: n.laid || !!n.locationAttrs?.anchors.every(a => a.resolved)
            }));

        // debug(JSON.stringify(allNodes.map(n => ({ name: n.node.name, laid: n.laid, x: n.node.locationAttrs?.x, y: n.node.locationAttrs?.y })), null, 2));

        const allNodeLookup = Object.fromEntries(allNodes.map(n => [n.node.name, n.node]));

        const unlaid = allNodes
            .filter(n => !isLaid(n.node))
            .filter(n => isAnchored(n.node))
            .filter(n => n.node.locationAttrs?.anchors.some(a => !a.resolved))
            .map(n => ({
                ...n,
                parent: findParent(n.node.name, allNodes),
                anchors: n.node.locationAttrs?.anchors.map(a => ({
                    ...a,
                    otherParent: findParent(a.otherId, allNodes),
                    otherNode: allNodeLookup[a.otherId],
                    canLay: allNodeLookup[a.otherId].laid
                }))
            }));

        if (unlaid.length === 0) {
            break;
        }

        const canLay = unlaid
            .map(n => ({
                ...n,
                anchors: n.anchors?.filter(a => a.canLay) || []
            }))
            .filter(n => n.anchors.length);

        if (unlaid.length && canLay.length === 0) {
            const unresolved = unlaid.map(n => ({
                name: n.node.name,
                dependsOn: n.anchors?.map(a => a.otherId)
            }))
                .map(n => `${n.name} depends on ${n.dependsOn?.join(', ')} ${n.dependsOn?.map(i => allNodeLookup[i].laid).join(', ')}`)
                .join('\n');

            throw new Error(`After ${pass} passes, no unlaid nodes have already resolved dependencies. Looks like there's a circular one. Here's the list:\n${unresolved}`);
        }

        // XXX: i've no idea where they get desync but n.parent.nodes.flat().find(mn => mn?.name === n.node.name)! does the trick
        const laidSome = canLay.flatMap(n => n.anchors.map(a => applyAnchor(n.parent.nodes.flat().find(mn => mn?.name === n.node.name)!, n.parent, a))).some(e => e);

        if (!laidSome) {
            const unresolved = canLay.map(n => ({
                name: n.node.name,
                dependsOn: n.anchors?.map(a => a.otherId)
            }))
                .map(n => `${n.name} depends on ${n.dependsOn?.join(', ')}`)
                .join('\n');

            throw new Error(`Last pass (${pass}) could not lay any nodes. Something's off...\n${unresolved}`);
        }
    }
    while (true)


    return tree;
};

export const absPositions = (tree: LayoutPass) => {

    const walkNodes: (parent: LayoutPass, node: LayoutPass) => LayoutPass = (parent: LayoutPass, node: LayoutPass) => {
        const newNode = {
            ...node,
            absPosition: {
                x: `${parent?.absPosition?.x ?? 0}.${node?.locationAttrs?.x ?? 0}`,
                y: `${parent?.absPosition?.y ?? 0}.${node?.locationAttrs?.y ?? 0}`,
            }
        }

        newNode.nodes = (newNode.nodes ?? []).map(nn => nn.map(n => !!n ? walkNodes(newNode, n) : undefined));

        return newNode;
    }

    const newRoot = walkNodes(tree, tree);

    type Abs = { name: string, abs: NestedXY };

    const absLoc: (node: LayoutPass) => Abs[] = (node: LayoutPass) => [
        {
            name: node.name,
            abs: node.absPosition
        },
        ...node.nodes
            .flat()
            .filter(n => !!n)
            .flatMap(n => absLoc(n!))
    ] as Abs[];

    return absLoc(newRoot)
        .reduce((sofar, curr) => ({
            ...sofar,
            [curr.name]: curr.abs
        }), {}) as Record<string, XY>;
};
