BBox Corner Match Validation

Check `sdf`
- `bbox`: compare with `expected-sdf`
- `expr`: compare with `expected-sdf` for exact placement

Check `admesh`
- `Size` (`Min/Max X/Y/Z`): final bbox must match expected corner condition
- `Volume`: should increase
- `Number of facets`: usually increases

Judge correct
- For max-corner tasks: target `Max X/Max Y/Max Z` is matched
- For min-corner tasks: target `Min X/Min Y/Min Z` is matched
- Non-target bbox sides should stay unchanged unless the case requires otherwise
