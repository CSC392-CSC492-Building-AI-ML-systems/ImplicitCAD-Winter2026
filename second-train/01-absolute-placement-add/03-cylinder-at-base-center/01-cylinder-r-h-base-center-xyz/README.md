# Cylinder R H Base-Center XYZ Test

## Description
This test validates absolute placement for a standard cylinder using base-center coordinates.

## Task
- Keep the existing geometry unchanged
- Add a cylinder with radius `2` and height `5`
- Place the cylinder base center at absolute coordinate `[-4,3,1]`
- Use `center=false` so the cylinder extends from `z=1` to `z=6`

## Key Learning Points
- Base-center coordinate interpretation for cylinders
- Vertical extent reasoning from base z plus height
- Absolute placement in mixed-sign coordinate space

## Expected Result
The output contains the original object plus one cylinder at base center `[-4,3,1]` with `r=2`, `h=5`.
