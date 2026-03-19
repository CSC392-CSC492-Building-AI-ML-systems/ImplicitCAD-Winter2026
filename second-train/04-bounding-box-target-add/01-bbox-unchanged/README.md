BBox Unchanged Validation

Goal
- Judge whether the output adds the required object while keeping the overall bbox unchanged.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- Primitive count should increase from `initial-sdf` to `pred-sdf`.
- The new object should be present inside the existing bbox.

What Should Stay Unchanged
- `bbox` should stay exactly the same from `initial-sdf` to `pred-sdf`.
- Final `bbox` should match `expected-sdf`.
- Existing objects should not move or resize.

How To Judge Correct
1. Check that `pred-sdf` bbox equals `initial-sdf` bbox.
2. Check that `pred-sdf` bbox also equals `expected-sdf` bbox.
3. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.
4. If exact `expr` match is too strict, verify:
- one new primitive was added
- the new primitive is fully inside the original bbox

Correct
- bbox is unchanged from initial
- bbox matches expected
- added object matches expected placement and size

Wrong
- bbox expands or shrinks
- object intersects the bbox boundary when it should stay inside
- wrong primitive type, count, or placement
