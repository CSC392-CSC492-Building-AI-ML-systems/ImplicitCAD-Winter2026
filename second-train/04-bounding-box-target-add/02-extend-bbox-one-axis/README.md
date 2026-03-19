Extend BBox One Axis Validation

Check `sdf`
- `bbox`: compare with `expected-sdf`
- Only the target boundary should move

Check `admesh`
- `Size` (`Min/Max X/Y/Z`): target side should change to the expected value
- Non-target sides should stay the same unless the prompt says otherwise
- `Volume`: should increase
- `Number of facets`: usually increases

Judge correct
- The correct axis changed
- The target min/max value is hit exactly
- Other bbox sides did not change unexpectedly
