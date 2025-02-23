import { describe, expect, test } from "vitest";
import { Sparse2D } from '../src/cli/common/sparsely.js';

describe('Sparecely tests', () => {
    test('Normal use', () => {
        const arr = new Sparse2D<string>();

        arr.put('1', -1, -1);

        expect(arr.toArray()).toEqual([['1']]);

        arr.put('2', 1, 1);

        expect(arr.toArray()).toEqual([
            ['1', undefined, undefined],
            [undefined, undefined, undefined],
            [undefined, undefined, '2'],
        ]);

        const drop = arr.put('3', 1, 1);

        expect(drop).toBe('2');

        expect(arr.toArray()).toEqual([
            ['1', undefined, undefined],
            [undefined, undefined, undefined],
            [undefined, undefined, '3'],
        ]);

        arr.put('4', -1, -2);

        expect(arr.toArray()).toEqual([
            ['4', undefined, undefined],
            ['1', undefined, undefined],
            [undefined, undefined, undefined],
            [undefined, undefined, '3'],
        ]);

        arr.put(undefined, -1, -1);

        expect(arr.toArray()).toEqual([
            ['4', undefined, undefined],
            [undefined, undefined, undefined],
            [undefined, undefined, undefined],
            [undefined, undefined, '3'],
        ]);
    });

    test('From', () => {
        const arr = Sparse2D.from([['1', '2']]);

        expect(arr.toArray()).toEqual([['1', '2']]);

        const arr2 = Sparse2D.from([['1', undefined], [undefined, '2']]);

        expect(arr2.toArray()).toEqual([['1', undefined], [undefined, '2']]);
    });
});