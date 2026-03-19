BBox Unchanged Validation

Check `sdf`
- `bbox`: `pred` must equal `initial` and `expected`
- `expr`: compare with `expected-sdf` if you want exact object placement

Check `admesh`
- `Size` (`Min/Max X/Y/Z`): must stay unchanged from `initial-admesh`
- `Volume`: should increase
- `Number of facets`: usually increases
- `Number of parts`: depends on whether the new object is connected

Judge correct
- A new object was added
- Overall bbox did not change
- Final bbox matches `expected`
