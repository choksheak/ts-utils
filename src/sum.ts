/**
 * Add all the numbers together in the given array. Treats null, undefined and
 * NaN as zero.
 */
export function sum(numbers: (number | null | undefined)[]): number {
    return numbers.reduce(
        (accumulated: number, current: number | null | undefined) => {
            const value = typeof (current) === "number"
                && !isNaN(current)
                && isFinite(current)
                ? current
                : 0;

            return accumulated + value;
        },
        0
    );
}
