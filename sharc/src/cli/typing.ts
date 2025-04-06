import { Model as ArcModel } from '@larc/larc/model';
import type { ArcReference, Layout } from '../language/generated/ast.js';
import { Sparse2D } from './common/sparsely.js';

export type SharcModel = Layout & {
    architecture: ArcReference & {
        node: ArcModel
    }
};

// export type LayoutNode = {
//     name: string,
//     kind: string,
//     title?: string
// };

// export type KindPass = LayoutNode & {
//     nodes: KindPass[]
// };

// export type SecondPass = LayoutNode & {
//     width: number,
//     height: number,
//     nodes: SecondPass[]
// };

export type Anchor = {
    otherId: string,
    ownDirection: 'above' | 'below' | 'left' | 'right'
};

export type XY = {
    x: number,
    y: number,
}

export type NestedXY = {
    x: string,
    y: string,
}

export type BoundingBox = {
    min: XY,
    max: XY
}

export type LocationAttrs = {
    anchors: Anchor[],
    boundingBox?: BoundingBox
}

export type LayoutNodeLight = XY & {
    name: string,
    kind: string,
    title?: string,

    width: number,
    height: number,
    absPosition?: NestedXY;
    nodes: LayoutNode[]
}

export type LayoutNode = LayoutNodeLight & {
    laid: boolean,
    fixed: boolean, // laid: true, fixed: false means the node can still be swapped
    locationAttrs: LocationAttrs,
    childrenGrid: Sparse2D<LayoutNode>
};
