import { Model as ArcModel } from '@larc/larc/model';
import type { ArcReference, Layout } from '../language/generated/ast.js';

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
    otherId: string,
    ownDirection: 'top' | 'bottom' | 'left' | 'right',
    otherSide: 'top' | 'bottom' | 'left' | 'right',
    resolved: boolean
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