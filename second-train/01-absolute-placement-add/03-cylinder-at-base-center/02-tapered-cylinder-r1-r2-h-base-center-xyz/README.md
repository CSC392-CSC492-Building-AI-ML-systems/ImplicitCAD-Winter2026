# Tapered Cylinder R1 R2 H Base-Center XYZ Test

## Description
This test validates absolute placement for a tapered cylinder defined by bottom radius, top radius, and height.

## Task
- Keep the existing geometry unchanged
- Add a tapered cylinder with `r1=3`, `r2=1.5`, `h=7`
- Place its base center at absolute coordinate `[6,-2,0]`
- Use `center=false`

## Key Learning Points
- Understanding tapered cylinder parameters (`r1` vs `r2`)
- Base-center placement with vertical extrusion along positive z
- Combining absolute placement with non-uniform radial profile

## Expected Result
The output contains the original object plus one tapered cylinder at base center `[6,-2,0]` with the requested dimensions.
