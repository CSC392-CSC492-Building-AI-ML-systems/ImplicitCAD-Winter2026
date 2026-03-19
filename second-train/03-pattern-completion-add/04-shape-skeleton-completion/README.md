Shape Skeleton Completion Validation

Check `sdf`
- `bbox`: compare with `expected-sdf`
- `expr`: compare with `expected-sdf` for exact structural layout

Check `admesh`
- `Volume`: should increase from `initial-admesh` to `expected-admesh`
- `Number of facets`: usually increases
- `Number of parts`: may stay the same or increase
- `Size` (`Min/Max X/Y/Z`): should match the final expected bbox

Judge correct
- Missing beam, arm, bar, or corner object must be added at the expected location
- Orientation and dimensions must match the pattern
- bbox may stay the same or change depending on whether the missing structure is interior or on the outside
