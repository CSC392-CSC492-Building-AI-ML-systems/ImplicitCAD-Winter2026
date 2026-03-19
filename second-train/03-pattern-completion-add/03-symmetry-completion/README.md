Symmetry Completion Validation

Check `sdf`
- `bbox`: compare with `expected-sdf`
- `expr`: compare with `expected-sdf` for exact mirrored placement

Check `admesh`
- `Volume`: should increase from `initial-admesh` to `expected-admesh`
- `Number of facets`: usually increases
- `Number of parts`: may stay the same or increase
- `Size` (`Min/Max X/Y/Z`): should match the final expected bbox

Judge correct
- The added object must be the correct mirror across `x=0`, `y=0`, or both
- Primitive type and size must match the symmetric partner
- bbox should expand only if the missing mirrored object was outside the initial bbox
