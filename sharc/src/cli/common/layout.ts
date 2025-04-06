import chalk from 'chalk';
import { Model as Larc } from '@larc/larc/model';
import { Attributes, Sharc } from '../../language/generated/ast.js';
import { LayoutNode, XY, NestedXY, Anchor } from '../typing.js';
import { Architecture, ArchNode, Attribute } from '@larc/larc/model';
import { Sparse2D } from './sparsely.js';
import _ from 'lodash';
export const debug = (...args: unknown[]) => console.error(chalk.gray(args));

const directionRE = /(?<direction>above|below|left|right)/;
const acnhorRE = /of\((?<otherId>[^)]+)\)/;

const isAnchor = (val: Attribute) => acnhorRE.test(val.value as string);

const parseArchor = (val: Attribute) => {
    const anchor = acnhorRE.exec(val.value as string);

    if (!directionRE.test(val.name) || !anchor) {
        throw new Error(`'${val.name} ${val.value}' is not a valid anchor, expecting '<'above' | 'below' | 'left' | 'right'> of(ID:side)'`)
    }

    return {
        ...(anchor?.groups as unknown as Anchor),
        ownDirection: val.name as 'above' | 'below' | 'left' | 'right'
    }
}

export const absPositions = (tree: LayoutNode) => {

    const walkNodes: (parent: LayoutNode, node: LayoutNode) => LayoutNode = (parent: LayoutNode, node: LayoutNode) => {
        const newNode = {
            ...node,
            absPosition: {
                x: `${parent?.absPosition?.x ?? 0}.${node?.x ?? 0}`,
                y: `${parent?.absPosition?.y ?? 0}.${node?.y ?? 0}`,
            }
        }

        newNode.nodes = (newNode.nodes ?? []).map(n => walkNodes(newNode, n));

        return newNode;
    }

    const newRoot = walkNodes(tree, tree);

    type Abs = { name: string, abs: NestedXY };

    const absLoc: (node: LayoutNode) => Abs[] = (node: LayoutNode) => [
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

const nodeAttr = (name: string, attrs: Attribute[], def: string, nodeName?: string) => {
    const res = (attrs ?? []).find(n => n.name === name);

    return res?.value ?? def;
};
const nodeKind = (node: ArchNode) => nodeAttr('kind', node.attrs?.attrs ?? [], node.name) as string;

export function initLayoutTree(model: Sharc, larc: Larc) {
    const arc = larc as Architecture;

    const processNode = (node: ArchNode, idx: number, parentGrid: Sparse2D<LayoutNode>): LayoutNode => {
        const layoutAttributes = model.layout
            .flatMap(ll => ll.layouts.filter(l => l.name === node.name) as Attributes[])
            .flatMap(as => as.attrs);

        const newNode: LayoutNode = {
            name: node.name,
            kind: nodeKind(node),
            title: node.title,
            width: 1,
            height: node.nodes.length,
            x: 0,
            y: idx,
            laid: false,
            fixed: false,
            nodes: [],
            childrenGrid: new Sparse2D<LayoutNode>(),
            locationAttrs: {
                anchors:
                    layoutAttributes
                        .filter(isAnchor)
                        .map(parseArchor),
                boundingBox: {
                    min: { x: 1, y: 1 },
                    max: { x: -1, y: -1 }
                }
            }
        };

        parentGrid.put(newNode, newNode.x, newNode.y);

        newNode.nodes = node.nodes.map((childNode: ArchNode, idx: number) => processNode(childNode, idx, newNode.childrenGrid));

        return newNode;
    };

    const rootNode = processNode(arc as unknown as ArchNode, 0, new Sparse2D<LayoutNode>());

    return rootNode;
}

export const relativePass = (model: Sharc, tree: LayoutNode) => {
    // const arc = model.architecture.node as Architecture;
    // const layouts = model.layouts;

    /*
    1. Recurssively iterate the tree and update the locationAttrs.boundingBox to reflect each anchor and potential x and y. An anchor can be resolved if the other node is laid out.
    2. Recusrsively iterate the tree, intersect the node's locationAttrs.boundingBox with the parent's locationAttrs.childrenGrid.dims, 
        expand it by 1 in each direction, and put the node in the first available position in the parent's childrenGrid.
        If all anchors are resolved, set the node's laid to true.
        Collect the number of nodes that have been laid out. Repeat if number is above zero.
    3. Recurssively iterate the tree and find all nodes that have laid to false. If the list is not empty, throw an error listing the nodes and their unresolved anchors.
    */

    // Step 1: Update bounding boxes based on anchors and potential x/y values
    const updateBoundingBoxes = (node: LayoutNode, parentGrid: Sparse2D<LayoutNode>): LayoutNode => {

        const layoutAttributes = model.layout
            .flatMap(ll => ll.layouts.filter(l => l.name === node.name) as Attributes[])
            .flatMap(as => as.attrs);

        const x = layoutAttributes.find(a => a.name === 'x')?.value as number | undefined;
        const y = layoutAttributes.find(a => a.name === 'y')?.value as number | undefined;

        const parentDims = parentGrid.dims;
        const parentBox = {
            min: { x: x ?? parentDims.minx - 1, y: y ?? parentDims.miny - 1 },
            max: { x: x ?? parentDims.maxx + 1, y: y ?? parentDims.maxy + 1 }
        };


        // Process each anchor
        const anchors = node.locationAttrs.anchors.map(anchor => {

            const boundingBox = { ...parentBox };

            // Find the target node in the tree
            const findTargetNode = (currentNode: LayoutNode): LayoutNode | undefined => {
                if (currentNode.name === anchor.otherId) {
                    return currentNode;
                }

                return currentNode.nodes
                    .map(child => findTargetNode(child!))
                    .find(n => !!n);
            };

            const targetNode = findTargetNode(tree);

            if (!targetNode) {
                throw new Error(`Node ${node.name} has anchor to ${anchor.otherId} but it wasn't found.`);
            }

            // If the target node is laid out, we can resolve the anchor
            if (!targetNode.laid) {
                // If the target node is not laid out, we can't resolve the anchor yet
                return {
                    ...anchor,
                    boundingBox,
                    resolved: false
                }
            }

            // Get the target node's position
            const targetX = targetNode.x;
            const targetY = targetNode.y;

            // Apply the anchor based on the direction
            switch (anchor.ownDirection) {
                case 'left':

                    // boundingBox.min.x = boundingBox.min.x;
                    boundingBox.min.y = targetY;
                    boundingBox.max.x = targetX - 1;
                    boundingBox.max.y = targetY;

                    break;
                case 'right':

                    boundingBox.min.x = targetX + 1;
                    boundingBox.min.y = targetY;
                    // boundingBox.max.x = targetX -1;
                    boundingBox.max.y = targetY;

                    break;
                case 'above':

                    boundingBox.min.x = targetX;
                    //boundingBox.min.y = targetY - 1;
                    boundingBox.max.x = targetX;
                    boundingBox.max.y = targetY - 1;

                    break;
                case 'below':

                    boundingBox.min.x = targetX;
                    boundingBox.min.y = targetY + 1;
                    boundingBox.max.x = targetX;
                    // boundingBox.max.y = targetY + 1;

                    break;
            }


            return {
                ...anchor,
                boundingBox,
                resolved: true
            };

        });

        const boundingBox = anchors.reduce((sofar, curr) => {
            return {
                min: { x: Math.min(sofar.min.x, curr.boundingBox.min.x), y: Math.min(sofar.min.y, curr.boundingBox.min.y) },
                max: { x: Math.max(sofar.max.x, curr.boundingBox.max.x), y: Math.max(sofar.max.y, curr.boundingBox.max.y) }
            }
        }, parentBox);

        node.locationAttrs.anchors = anchors;
        node.locationAttrs.boundingBox = anchors.every(a => a.resolved) ? boundingBox : undefined;

        node.nodes.map(n => updateBoundingBoxes(n, node.childrenGrid));

        return node;
    };

    // Step 2: Place nodes in the grid based on bounding boxes
    const placeNodesInGrid = (allNodes: LayoutNode[], node: LayoutNode, parent?: LayoutNode): LayoutNode => {

        node.nodes.map(n => placeNodesInGrid(allNodes, n, node))

        if (!parent || node.laid || !node.locationAttrs.boundingBox) {
            return node;
        }

        const boundingBox = node.locationAttrs.boundingBox;

        const xyRange = _.range(boundingBox.min.y, boundingBox.max.y + 1)
            .flatMap(y => _.range(boundingBox.min.x, boundingBox.max.x + 1)
                .map(x => ({ x, y })));

        const firstAvailable = xyRange.find(xy => !parent.childrenGrid.get(xy.x, xy.y)?.laid);

        if (!firstAvailable) {
            throw new Error(`Node ${node.name} could not be placed in the grid - somehow an infinite grid is full.`);
        }

        const { x, y } = firstAvailable;

        const alreadyThere = parent.childrenGrid.get(x, y);

        if (alreadyThere) {
            parent.childrenGrid.put(alreadyThere, node.x, node.y);

            alreadyThere.x = node.x;
            alreadyThere.y = node.y;
        } else {
            parent.childrenGrid.delete(node.x, node.y);
        }

        parent.childrenGrid.put(node, x, y);
        node.x = x;
        node.y = y;

        // If all anchors are resolved, mark the node as laid
        node.laid = node.locationAttrs.anchors.every(a => allNodes.find(n => n.name === a.otherId)?.laid);

        return node;
    };

    // Step 3: Check for unresolved nodes
    const findUnresolvedNodes = (node: LayoutNode): string[] => {
        const unresolvedNodes: string[] = [];

        if (!node.laid) {
            unresolvedNodes.push(node.name);
        }

        return [
            ...unresolvedNodes,
            ...node.nodes
                .flatMap(child => findUnresolvedNodes(child!))
        ];
    };

    let updatedTree = tree;
    let beforeCount = findUnresolvedNodes(tree).length;

    const flatten = (node: LayoutNode): LayoutNode[] => {
        return [node, ...node.nodes.flatMap(n => flatten(n!))];
    }

    // Repeat the grid placement until no more nodes are laid out
    do {
        updatedTree = updateBoundingBoxes(updatedTree, new Sparse2D<LayoutNode>());


        const allNodes = flatten(updatedTree);

        updatedTree = placeNodesInGrid(allNodes, updatedTree);

        const newCount = flatten(updatedTree).filter(n => !n.laid).length;
        if (newCount === beforeCount) {
            break
        }

        beforeCount = newCount;
    } while (true);

    // Check for unresolved nodes
    const unresolvedNodes = flatten(updatedTree).filter(n => !n.laid);

    if (unresolvedNodes.length > 1) { // root node is always unresolved
        throw new Error(`Unresolved nodes: ${unresolvedNodes.map(n => n.name).join(', ')}`);
    }

    return updatedTree;
};

