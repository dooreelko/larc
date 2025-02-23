import { XY } from '../typing.js';

export class Sparse2D<T> {
    private elems: Record<string, [pos: XY, el: T]> = {};

    constructor() { }

    static from<T>(vals: (T | undefined)[][]): Sparse2D<T> {
        const res = new Sparse2D<T>();

        vals.forEach((row, y) => row.forEach((el, x) => res.put(el, x, y)));

        return res;
    }

    private addr(x: number, y: number) { return `${x}:${y}` }

    delete(x: number, y: number): T | undefined {
        const old = this.elems[this.addr(x, y)];

        delete this.elems[this.addr(x, y)];

        return old?.[1];
    }

    put(val: T | undefined, x: number, y: number): T | undefined {
        if (!val) {
            return this.delete(x, y);
        }

        const old = this.elems[this.addr(x, y)];

        this.elems[this.addr(x, y)] = [{ x, y }, val];

        return old?.[1];
    }

    get(x: number, y: number): T | undefined {
        return this.elems[this.addr(x, y)]?.[1];
    }

    public dims() {
        return Object.entries(this.elems).reduce((sofar, curr) => ({
            minx: Math.min(sofar.minx, curr[1][0].x),
            maxx: Math.max(sofar.maxx, curr[1][0].x),
            miny: Math.min(sofar.miny, curr[1][0].y),
            maxy: Math.max(sofar.maxy, curr[1][0].y),
        }), {
            minx: Number.POSITIVE_INFINITY,
            maxx: Number.NEGATIVE_INFINITY,
            miny: Number.POSITIVE_INFINITY,
            maxy: Number.NEGATIVE_INFINITY
        });
    }

    get width(): number {
        return 0;
    }

    get height(): number {
        return 0;
    }

    unorderedList(): [pos: XY, el: T][] {
        return Object.values(this.elems);
    }

    normalizedList(): [pos: XY, el: T][] {
        return Object.values(Sparse2D.from(this.toArray()));
    }

    toArray(): (T | undefined)[][] {
        const list = Object.entries(this.elems);

        if (!list.length) {
            return [];
        }

        const dims = this.dims();

        const res = Array.from(Array(dims.maxy - dims.miny + 1), a => Array(dims.maxx - dims.minx + 1).fill(undefined));

        list.forEach(el => res[el[1][0].y - dims.miny][el[1][0].x - dims.minx] = el[1][1]);

        return res;
    }
}