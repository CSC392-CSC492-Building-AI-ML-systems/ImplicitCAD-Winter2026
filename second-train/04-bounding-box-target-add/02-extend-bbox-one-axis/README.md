Extend BBox One Axis Validation

Goal
- Judge whether the output adds an object that extends the bbox along exactly the intended axis to the intended target.

Read From SDF
- `bbox`: parse from `resolution ... in box (V3 xmin ymin zmin,V3 xmax ymax zmax)`.
- `expr`: parse the geometry expression line starting with `union [`.
- Ignore the final `<<ghc: ...>>` line.

What Should Change
- Exactly one target bbox boundary should move to the required value, such as `max x`, `max y`, or `max z`.
- Primitive count should increase from `initial-sdf` to `pred-sdf`.

What Should Stay Unchanged
- Non-target bbox boundaries should stay the same unless the prompt explicitly requires otherwise.
- Existing objects should not move or resize.

How To Judge Correct
1. Compare `pred-sdf` bbox with `expected-sdf` bbox.
2. Confirm the targeted boundary changed from `initial-sdf` to `pred-sdf`.
3. Confirm the non-target boundaries remain equal to `initial-sdf` when expected.
4. Compare normalized `expr` in `pred-sdf` with normalized `expr` in `expected-sdf`.

Correct
- target bbox boundary hits the exact expected value
- non-target bbox boundaries remain unchanged when required
- added primitive matches expected

Wrong
- wrong axis changed
- target boundary stops short or overshoots
- extra bbox boundaries changed unexpectedly
