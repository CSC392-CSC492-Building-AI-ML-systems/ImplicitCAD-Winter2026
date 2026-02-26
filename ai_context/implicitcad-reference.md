# ImplicitCAD / ExtOpenSCAD Complete Language Reference

> **Purpose:** This document is a complete technical reference of all built-in functions, primitives, transformations, language constructs, and data types in ImplicitCAD's ExtOpenSCAD language. It is intended for AI code generation, code review, and understanding.

---

## Overview

ImplicitCAD is a Haskell-based CAD engine that parses a superset of OpenSCAD called **ExtOpenSCAD** (`.escad` or `.scad` files). It represents geometry using **implicit functions** (signed distance functions), where negative values are inside an object and positive values are outside. This enables uniquely smooth rounded operations not possible in standard CSG-based tools.

All units for positions and sizes are **millimeters (mm)**. All angles in the language API are **degrees**. The internal Haskell layer uses radians, but the parser converts automatically.

---

## Part 1: Type System

### Primitive Value Types

| Type | Description | Example |
|------|-------------|---------|
| `Number` (ℝ) | A real number (64-bit double internally) | `3.14`, `42`, `-0.5` |
| `Bool` | Boolean true or false | `true`, `false` |
| `String` | A text string | `"hello"` |
| `List` | An ordered list of any values | `[1, 2, 3]`, `[[1,0],[0,1]]` |
| `Function` | A first-class function value | `function(x) x*2` |
| `Module` | A geometry-producing module | `sphere`, `cube`, user modules |
| `2D Object` | A symbolic 2D geometry | result of `circle(5)` |
| `3D Object` | A symbolic 3D geometry | result of `sphere(5)` |
| `undef` / undefined | The absence of a value | uninitialized variable |

### Vector Types

Vectors are written as lists of numbers:
- **2D vector**: `[x, y]` — used for 2D positions, sizes, translations
- **3D vector**: `[x, y, z]` — used for 3D positions, sizes, translations, rotation axes
- **Matrix**: list of lists, e.g., `[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]` (4×4 for `multmatrix`)

---

## Part 2: 3D Primitive Modules

### `sphere`

Creates a 3D sphere centered at the origin.

```scad
sphere(r=N);     // by radius
sphere(d=N);     // by diameter (equivalent to r=N/2)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r` | Number | — | Radius of the sphere (required, unless `d` given) |
| `d` | Number | — | Diameter of the sphere (alternative to `r`) |

**Examples:**
```scad
sphere(3);
sphere(r=5);
sphere(d=10);
```

---

### `cube`

Creates a 3D rectangular box. Can be centered or start from origin. Supports edge rounding (ImplicitCAD extension).

```scad
cube(size=[x,y,z], center=true/false, r=0);  // from size vector
cube([x,y,z], center=true/false, r=0);        // positional size
cube(N, center=false);                         // uniform cube of side N
cube(x=X, y=Y, z=Z, center=false, r=0);       // named dimensions
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | Number or [x,y,z] | — | Size of the box; scalar or vector |
| `x` | Number or [min,max] | — | X dimension or interval |
| `y` | Number or [min,max] | — | Y dimension or interval |
| `z` | Number or [min,max] | — | Z dimension or interval |
| `center` | Bool | `false` | If true, center at origin; if false, corner at origin |
| `r` | Number | `0` | **[ImplicitCAD only]** Radius for rounding edges and corners |

**Examples:**
```scad
cube(4);
cube([2, 3, 4]);
cube(size=[2,3,4], center=true);
cube(size=[10,10,10], r=2);  // rounded edges
```

---

### `cylinder`

Creates a 3D cylinder (or frustum/prism if parameters vary). Optionally center along z-axis.

```scad
cylinder(r=N, h=N, center=false);
cylinder(r1=N, r2=N, h=N, center=false);  // frustum (cone frustum)
cylinder(r=N, h=N, $fn=6);               // regular prism (hexagon etc.)
cylinder(d=N, h=N);                       // by diameter
cylinder(d1=N, d2=N, h=N);               // frustum by diameter
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r` | Number | `1` | Radius (uniform for both ends) |
| `r1` | Number | `1` | Bottom radius (overrides `r`) |
| `r2` | Number | `1` | Top radius (overrides `r`) |
| `d` | Number | `2` | Diameter (uniform; alternative to `r`) |
| `d1` | Number | `2` | Bottom diameter |
| `d2` | Number | `2` | Top diameter |
| `h` | Number or [min,max] | `1` | Height; or height interval |
| `$fn` | Integer | `-1` | If ≥ 3, creates a regular n-sided prism instead of a cylinder |
| `center` | Bool | `false` | Center cylinder vertically around z=0 |

**Examples:**
```scad
cylinder(r=10, h=30);
cylinder(r=10, h=30, center=true);
cylinder(r1=4, r2=6, h=10);      // frustum
cylinder(r=5, h=10, $fn=6);     // hexagonal prism
```

---

### `cone`

Creates a 3D cone (a cylinder whose top radius is 0). **ImplicitCAD-specific** primitive.

```scad
cone(r=N, h=N, center=false);
cone(d=N, h=N, center=false);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r` | Number | `1` | Base radius |
| `d` | Number | `2` | Base diameter (alternative to `r`) |
| `h` | Number or [min,max] | `1` | Height |
| `center` | Bool | `false` | Center vertically around z=0 |

**Example:**
```scad
cone(r=10, h=30, center=true);
```

---

### `torus`

Creates a donut-shaped 3D torus. **ImplicitCAD-only** — standard OpenSCAD has no native torus.

```scad
torus(r1=N, r2=N);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r1` | Number | `1` | Major radius (center of tube to center of torus) |
| `r2` | Number | `1` | Minor radius (radius of the tube itself) |

**Example:**
```scad
torus(r1=10, r2=5);
```

---

### `ellipsoid`

Creates a 3D ellipsoid (stretched sphere). **ImplicitCAD-only**.

```scad
ellipsoid(a=N, b=N, c=N);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `a` | Number | `1` | Radius along X axis |
| `b` | Number | `1` | Radius along Y axis |
| `c` | Number | `1` | Radius along Z axis |

**Example:**
```scad
ellipsoid(a=1, b=2, c=3);
```

---

## Part 3: 2D Primitive Modules

### `square`

Creates a 2D rectangle (axis-aligned). Supports corner rounding (ImplicitCAD extension).

```scad
square([x,y], center=false, r=0);  // from size vector
square(N, center=false, r=0);       // uniform square
square(x=X, y=Y, center=false, r=0); // named dimensions
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | Number or [x,y] | — | Width and height |
| `x` | Number or [min,max] | — | X dimension or interval |
| `y` | Number or [min,max] | — | Y dimension or interval |
| `center` | Bool | `false` | Center at origin |
| `r` | Number | `0` | **[ImplicitCAD only]** Radius for rounding corners |

**Examples:**
```scad
square(4);
square([3, 5]);
square(size=[3,4], center=true, r=0.5);
square(x=[-2,2], y=[-1,5]);  // interval form
```

---

### `circle`

Creates a 2D circle, or a regular polygon if `$fn` is specified.

```scad
circle(r=N);          // circle by radius
circle(d=N);          // circle by diameter
circle(r=N, $fn=N);   // regular polygon
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r` | Number | — | Radius (required unless `d` given) |
| `d` | Number | — | Diameter (alternative to `r`) |
| `$fn` | Integer | `-1` | If ≥ 3, creates a regular n-sided polygon instead of circle |

**Examples:**
```scad
circle(r=10);         // circle
circle(d=20);         // same circle
circle(r=5, $fn=6);  // hexagon
circle(r=5, $fn=3);  // triangle
```

---

### `polygon`

Creates a 2D polygon from a list of 2D points. Points are connected in order and the shape is closed automatically.

```scad
polygon(points=[[x1,y1], [x2,y2], ...]);
polygon([[x1,y1], [x2,y2], ...]);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `points` | List of [x,y] | — | Vertices of the polygon (required) |

**Notes:**
- The polygon must have at least 3 points.
- If 4 points form a grid-aligned rectangle, it is internally optimized as a `rect`.

**Example:**
```scad
polygon([(0,0), (0,10), (10,0)]);
polygon(points=[[0,0],[10,0],[10,10],[0,10]]);
```

---

## Part 4: CSG (Constructive Solid Geometry) Operations

All CSG operations work on both 2D and 3D objects. Mixed 2D/3D children are handled separately.

### `union`

Combines all child objects into one by taking the mathematical union (the "OR" of their regions). Supports smooth blending at interfaces (ImplicitCAD extension).

```scad
union() { child1; child2; ... }
union(r=N) { child1; child2; ... }  // rounded union
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r` | Number | `0` | **[ImplicitCAD only]** Rounding radius at interfaces. Zero = standard sharp union. |

**Examples:**
```scad
union() {
    square([80,80]);
    translate([80,80]) circle(30);
}

union(r=14) {   // smooth blending
    square([80,80]);
    translate([80,80]) circle(30);
}
```

---

### `intersection`

Computes the intersection of all child objects (the region that is inside ALL children simultaneously). Supports rounding.

```scad
intersection() { child1; child2; ... }
intersection(r=N) { child1; child2; ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r` | Number | `0` | **[ImplicitCAD only]** Rounding radius at intersection edges |

**Example:**
```scad
intersection(r=2) {
    cube([20,20,20]);
    sphere(15);
}
```

---

### `difference`

Subtracts all children after the first from the first child. Supports rounding.

```scad
difference() { base; sub1; sub2; ... }
difference(r=N) { base; sub1; sub2; ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `r` | Number | `0` | **[ImplicitCAD only]** Rounding radius at cut edges |

**Notes:**
- First child is the base object.
- All subsequent children are subtracted from the base.
- Requires at least one child.

**Examples:**
```scad
difference() {
    sphere(20);
    cylinder(r=17, h=100, center=true);
}

difference(r=1) {
    cube([30,30,15], center=true);
    cylinder(h=20, r=10, center=true);
}
```

---

## Part 5: Transformations

Transformations apply to all child objects in their suite.

### `translate`

Moves (translates) child objects by a given vector.

```scad
translate([x,y,z]) { ... }
translate([x,y]) { ... }         // 2D translation
translate(v=[x,y,z]) { ... }
translate(x=X, y=Y, z=Z) { ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `v` | [x,y], [x,y,z], or scalar | — | Translation vector |
| `x` | Number | — | X component |
| `y` | Number | — | Y component |
| `z` | Number | `0` | Z component (optional) |

**Notes:**
- For 2D objects, only x and y are used.
- If a scalar is given, translates only along x.

**Examples:**
```scad
translate([2,3]) circle(4);
translate([5,6,7]) sphere(5);
translate(10) cube(5);           // translates along x only
```

---

### `rotate`

Rotates child objects. Angles are in **degrees**.

```scad
rotate(a) { ... }                  // 2D: rotate by angle a
rotate([x,y,z]) { ... }            // 3D: Euler angles (degrees)
rotate(a=A, v=[x,y,z]) { ... }     // 3D: rotate A degrees around axis v
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `a` | Number or [x,y,z] | — | Rotation angle(s) in degrees |
| `v` | [x,y,z] | `[0,0,1]` | Axis of rotation (for single-angle rotation) |

**Notes:**
- For 2D objects, only the z-component rotation applies.
- Euler angles: `[yz_angle, zx_angle, xy_angle]` — these rotate around the respective planes.
- The `v` parameter defines the rotation axis when `a` is a single number.

**Examples:**
```scad
rotate(45) square(10);           // 2D rotation 45 degrees
rotate([30, 0, 0]) cube(5);     // tilt around X
rotate(a=90, v=[1,0,0]) cube(5); // rotate 90° around X axis
```

---

### `scale`

Scales child objects by a factor along each axis.

```scad
scale(v) { ... }                  // v is scalar or vector
scale([x,y]) { ... }              // 2D scale
scale([x,y,z]) { ... }            // 3D scale
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `v` | Number, [x,y], or [x,y,z] | — | Scale factor (scalar = uniform, vector = per-axis) |

**Examples:**
```scad
scale(2) square(5);              // double size
scale([2,3]) square(5);         // different x/y scales
scale([2,3,4]) cube(5);         // different x/y/z scales
```

---

### `mirror`

Mirrors child objects across a plane defined by its normal vector.

```scad
mirror([x,y,z]) { ... }
mirror(v=[x,y,z]) { ... }
mirror(x=X, y=Y, z=Z) { ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `v` | [x,y], [x,y,z], or scalar | — | Normal vector of the mirror plane |
| `x`, `y`, `z` | Number | — | Components of the normal vector |

**Notes:**
- The mirror plane passes through the origin and is perpendicular to the given vector.
- `mirror([1,0,0])` mirrors across the YZ plane (flips x).
- `mirror([0,1,0])` mirrors across the XZ plane (flips y).

**Examples:**
```scad
mirror([1, 0, 0]) cube(3);                  // mirror across YZ plane
mirror(v=[1,1,0]) cube(3);                  // mirror across plane with normal [1,1,0]
mirror([1,0,0]) translate([2,2,0]) cube(1); // mirror a translated cube
```

---

### `multmatrix`

Applies an arbitrary affine transformation via a 4×4 (or 3×4) matrix. This is the general-purpose linear transform.

```scad
multmatrix(m=[[...4x4...]]) { ... }
multmatrix(m=[[...3x4...]]) { ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `m` | 4×4 or 3×4 matrix | — | Affine transformation matrix |

**Notes:**
- A 3×4 matrix is treated as a 4×4 with the last row `[0,0,0,1]`.
- Can perform rotation, translation, shear, and scale simultaneously.
- The matrix acts on homogeneous coordinates `[x, y, z, 1]`.

**Example:**
```scad
angle = PI/4;
multmatrix(m = [
    [cos(angle), -sin(angle), 0, 0],
    [sin(angle),  cos(angle), 0, 30],
    [0,           0,          1, 0],
    [0,           0,          0, 1]
]) cylinder(r=10, h=10);
```

---

## Part 6: Extrusion Operations

### `linear_extrude`

Extrudes a 2D shape into a 3D object along the Z axis. Supports advanced twist, scale, and translation as functions of height (ImplicitCAD extensions).

```scad
linear_extrude(height=N) { 2d_shape; }
linear_extrude(height=N, center=true, twist=90, scale=1.5, r=5) { ... }
// Function-based parameters (ImplicitCAD only):
linear_extrude(height=N, twist(h) = 35*cos(h*2*pi/60)) { ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `height` | Number or function | `1` | Total extrusion height; can be `function(x,y) ...` for complex heights |
| `center` | Bool | `false` | Center the extrusion vertically around z=0 |
| `twist` | Number or `twist(h) = expr` | `0` | Total twist in degrees, or a function of height h |
| `scale` | Number, [x,y], or function | `1` | Scale factor at the top; or a function of height h |
| `translate` | [x,y] or function | `[0,0]` | 2D offset at each height level; or a function of height h |
| `r` | Number | `0` | **[ImplicitCAD only]** Round the top and bottom caps |

**Notes:**
- `twist`, `scale`, and `translate` as functions of height `h` are **ImplicitCAD-only** features.
- Function syntax: `twist(h) = 35*cos(h*2*pi/60)` — the parameter `h` ranges from 0 to `height`.
- `r > 0` rounds the top and bottom of the extrusion.

**Examples:**
```scad
linear_extrude(height=40, center=true) circle(10);

linear_extrude(height=40, twist=90) square(5);

linear_extrude(height=40, r=5) circle(10);                          // rounded caps

linear_extrude(height=40, twist(h) = 35*cos(h*2*pi/60)) {         // variable twist
    union(r=8) { circle(10); translate([22,0]) circle(10); }
}
```

---

### `rotate_extrude`

Revolves a 2D shape around the Z axis to create a 3D solid of revolution.

```scad
rotate_extrude() { 2d_shape; }
rotate_extrude(angle=360, r=0, translate=[0,0], rotate=0) { ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `angle` | Number | `360` | Total sweep angle in degrees (use `angle`, **not** `a`) |
| `r` | Number | `0` | **[ImplicitCAD only]** Round the swept edge |
| `translate` | [x,y] or function | `[0,0]` | Translate the 2D shape during sweep |
| `rotate` | Number or function | `0` | Rotate the 2D shape during sweep |

**Notes:**
- The 2D shape should be on the positive X side of the Y axis.
- `angle=360` creates a full revolution; values less than 360 create partial sweeps.

**Example:**
```scad
rotate_extrude() translate([20,0]) circle(10);            // torus-like shape
rotate_extrude(angle=180) translate([10,0]) square(5);    // half revolution
```

---

## Part 7: ImplicitCAD-Specific Utility Modules

### `shell`

Hollows out an object, leaving only a shell of the specified thickness.

```scad
shell(w=N) { object; }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `w` | Number | — | Wall thickness of the shell (required) |

**Example:**
```scad
shell(w=2) sphere(20);           // hollow sphere with 2mm walls
shell(w=3) cube([10,10,10]);
```

---

### `projection`

Slices a 3D object with the XY plane (z=0) and returns the 2D cross-section. Currently only `cut=true` is supported.

```scad
projection(cut=true) { 3d_object; }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `cut` | Bool | `false` | If `true`, slices at z=0. `cut=false` is not yet implemented. |

**Example:**
```scad
projection(cut=true) sphere(10);     // gives a circle of radius 10
```

---

### `pack`

Packs multiple 2D (or 3D) objects into a 2D bounding box with a minimum separation.

```scad
pack(size=[w,h], sep=N) { obj1; obj2; ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `size` | [w, h] | — | The 2D bounding box to fit objects in (required) |
| `sep` | Number | — | Minimum gap between packed objects (required) |

**Notes:**
- If 3D objects are provided, they are packed using their bounding box footprint.
- Returns an error if the objects cannot be packed in the given area.

**Example:**
```scad
pack([45,45], sep=2) {
    circle(10); circle(10); circle(10); circle(10);
}
```

---

### `unit`

Scales all child objects so that their dimensions are interpreted in the given unit, converting to millimeters.

```scad
unit("inch") { ... }
unit("mm") { ... }
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `unit` | String | — | Name of the unit to use (required) |

**Supported units:**

| Unit string | Aliases | Conversion to mm |
|-------------|---------|-----------------|
| `"mm"` | — | 1.0 |
| `"cm"` | — | 10.0 |
| `"dm"` | — | 100.0 |
| `"m"` | — | 1000.0 |
| `"km"` | — | 1,000,000.0 |
| `"inch"` | `"in"` | 25.4 |
| `"foot"` | `"ft"` | 304.8 |
| `"yard"` | `"yd"` | 914.4 |
| `"µm"` | `"um"` | 0.001 |
| `"nm"` | — | 0.0000001 |

**Example:**
```scad
unit("inch") {
    cube([1, 1, 1]);    // 1-inch cube (25.4mm)
}
```

---

### `color`

Accepts children and applies a color (not currently implemented for rendering, but children are still processed). Prints a warning. Exists for OpenSCAD compatibility.

```scad
color("red") { ... }
color([r,g,b]) { ... }
```

---

### `echo`

Prints values to the output/console. A varargs module.

```scad
echo(value1, value2, ...);
echo(name=value, ...);
```

In OpenSCAD-compatibility mode, output is formatted as `ECHO: value`. In native ExtOpenSCAD mode, string values are printed directly (without quotes).

**Examples:**
```scad
echo("hello");
echo(c, a);
echo(x=42, y=sin(pi/2));
```

---

### `for`

Iterates over a list (or range), executing the child suite for each value. Unlike standard OpenSCAD, **variables can be reassigned** across iterations.

```scad
for (var = list) { ... }
for (var = [start:end]) { ... }
for (var = [start:step:end]) { ... }
for (i = [0:5]) { translate([i*10,0,0]) cube(5); }
```

**Notes:**
- `var` is bound to each element in the list for each iteration.
- Multiple nested for variables can be used: `for (x=[0:3], y=[0:3]) { ... }`.
- Variable reassignment across loop iterations is supported (unlike standard OpenSCAD).

**Example:**
```scad
a = 5;
for (c = [1, 2, 3]) {
    echo(c);
    a = a * c;    // reassignment works in ImplicitCAD
    echo(a);
}
```

---

## Part 8: Mathematical Functions

All math functions operate on numbers (real-valued doubles).

### Trigonometric Functions

> **Note:** Inputs are in **radians** for all trig functions (NOT degrees). This differs from standard OpenSCAD which uses degrees. Convert using `value * pi / 180`.

| Function | Signature | Description |
|----------|-----------|-------------|
| `sin(x)` | ℝ → ℝ | Sine of x (radians) |
| `cos(x)` | ℝ → ℝ | Cosine of x (radians) |
| `tan(x)` | ℝ → ℝ | Tangent of x (radians) |
| `asin(x)` | ℝ → ℝ | Arc sine; clamped to avoid NaN for |x|>1 |
| `acos(x)` | ℝ → ℝ | Arc cosine; clamped to avoid NaN for |x|>1 |
| `atan(x)` | ℝ → ℝ | Arc tangent; returns value in (-π/2, π/2) |
| `atan2(y, x)` | ℝ → ℝ → ℝ | Two-argument arc tangent; returns angle in (-π, π] |
| `sinh(x)` | ℝ → ℝ | Hyperbolic sine |
| `cosh(x)` | ℝ → ℝ | Hyperbolic cosine |
| `tanh(x)` | ℝ → ℝ | Hyperbolic tangent |

---

### Arithmetic Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `abs(x)` | ℝ → ℝ | Absolute value |
| `sign(x)` | ℝ → ℝ | Sign: returns -1, 0, or 1 |
| `floor(x)` | ℝ → ℝ | Round down to nearest integer |
| `ceil(x)` | ℝ → ℝ | Round up to nearest integer |
| `round(x)` | ℝ → ℝ | Round to nearest integer |
| `sqrt(x)` | ℝ → ℝ | Square root; clamped to 0 for negative input |
| `exp(x)` | ℝ → ℝ | e raised to the power x |
| `ln(x)` | ℝ → ℝ | Natural logarithm; clamped to avoid -Infinity |
| `log(x)` | ℝ → ℝ | Same as `ln` (natural log, not log base 10) |
| `pow(x, y)` | ℝ → ℝ → ℝ | x raised to the power y (equivalent to `x^y`) |
| `max(a, b)` | ℝ → ℝ → ℝ | Maximum of two values |
| `min(a, b)` | ℝ → ℝ → ℝ | Minimum of two values |
| `negate(x)` | ℝ → ℝ | Negate a number or list |

---

### Arithmetic Operators

| Operator | Types | Description |
|----------|-------|-------------|
| `a + b` | ℝ+ℝ, [ℝ]+[ℝ], ℝ+[ℝ] | Addition (element-wise for vectors) |
| `a - b` | ℝ-ℝ, [ℝ]-[ℝ] | Subtraction (element-wise for vectors) |
| `a * b` | ℝ*ℝ, ℝ*[ℝ], [ℝ]*[ℝ], mat*mat | Multiplication; dot product, or matrix multiplication |
| `a / b` | ℝ/ℝ, [ℝ]/ℝ | Division (element-wise for vector/scalar) |
| `a % b` | ℝ%ℝ | Modulo (integer modulo: `floor(a) mod floor(b)`) |
| `a ^ b` | ℝ^ℝ | Exponentiation (**ImplicitCAD extension**; standard OpenSCAD uses `pow()`) |
| `-a` | -ℝ, -[ℝ] | Unary negation |

**Vector/Matrix multiplication:**
- `ℝ * [ℝ]` — scalar times vector (element-wise)
- `[ℝ] * [ℝ]` — element-wise product (vectors); dot product for equal-length vectors
- `[[ℝ]] * [[ℝ]]` — matrix × matrix multiplication
- `[[ℝ]] * [ℝ]` — matrix × vector multiplication
- `[ℝ] * [[ℝ]]` — vector × matrix multiplication

---

### Comparison and Logical Operators

| Operator | Description |
|----------|-------------|
| `a < b` | Less than |
| `a > b` | Greater than |
| `a <= b` | Less than or equal |
| `a >= b` | Greater than or equal |
| `a == b` | Equal (works for any type) |
| `a != b` | Not equal |
| `a && b` | Logical AND |
| `a \|\| b` | Logical OR |
| `!a` | Logical NOT |
| `cond ? a : b` | Ternary conditional expression |

---

## Part 9: List and String Functions

### `len(x)`

Returns the length of a list or string.

```scad
len([1,2,3])     // → 3
len("hello")     // → 5
```

---

### `index(list, i)` — also written as `list[i]`

Returns the element at index `i` (0-based) in a list or character at position `i` in a string.

```scad
index([10,20,30], 1)   // → 20
[10,20,30][1]           // → 20  (bracket syntax)
"hello"[0]              // → "h"
```

**Notes:**
- Index out of bounds returns an error.
- Works with strings to extract single-character strings.

---

### `splice(list, start, end)`

Extracts a sublist or substring from index `start` (inclusive) to `end` (exclusive). Negative indices count from the end.

```scad
splice([1,2,3,4,5], 1, 3)   // → [2, 3]
splice("hello", 1, 3)        // → "el"
```

| Parameter | Description |
|-----------|-------------|
| `list` | List or string to slice |
| `start` | Start index (inclusive); `undef` = 0 |
| `end` | End index (exclusive); `undef` = length |

---

### `map(f, list)`

Applies function `f` to every element of `list` and returns a new list of results.

```scad
map(cos, [0, pi/2, pi])     // → [1, ~0, -1]
map(function(x) x*2, [1,2,3])  // → [2, 4, 6]
```

---

### `sum(list)`

Returns the sum of all elements in a list. Also works as `sum(a, b)` to add two values.

```scad
sum([1, 2, 3, 4])   // → 10
sum([])              // → 0
```

---

### `prod(list)`

Returns the product of all elements in a list. Also works as `prod(a, b)`.

```scad
prod([1, 2, 3, 4])   // → 24
prod([])              // → 1
```

---

### `list_gen(params)`

Generates a list of numbers in a range.

```scad
list_gen([start, end])         // integers from ceil(start) to floor(end)
list_gen([start, step, end])   // values from start to end with given step
```

| Form | Description |
|------|-------------|
| `[a, b]` | Integers from `⌈a⌉` to `⌊b⌋` (like `a:b` in OpenSCAD) |
| `[a, step, b]` | From `a` to `b` stepping by `step` |

**Examples:**
```scad
list_gen([0, 5])        // → [0, 1, 2, 3, 4, 5]
list_gen([0, 2, 10])    // → [0, 2, 4, 6, 8, 10]
```

---

### `lookup(key, table)`

Looks up a value from a table of `[key, value]` pairs. If the key falls between two table entries, linearly interpolates. If outside bounds, uses the nearest entry.

```scad
lookup(2.5, [[0,0],[5,10],[10,5]])   // → linearly interpolated
```

| Parameter | Description |
|-----------|-------------|
| `key` | The key to look up |
| `table` | A list of `[key, value]` pairs, should be ordered by key |

---

### `rands(min, max, count)`

Generates a list of `count` random numbers uniformly distributed between `min` and `max`.

```scad
rands(0, 1, 5)    // → [0.37, 0.91, 0.12, 0.64, 0.28]  (example)
```

| Parameter | Description |
|-----------|-------------|
| `min` | Lower bound |
| `max` | Upper bound |
| `count` | Number of random values to generate (rounded to integer) |

---

### `str(value)`

Converts any value to its string representation.

```scad
str(42)          // → "42"
str([1,2,3])     // → "[1.0,2.0,3.0]"
str(true)        // → "True"
```

---

### `++` — Concatenation Operator

Concatenates two lists or two strings. **ImplicitCAD extension** (standard OpenSCAD uses `concat()`).

```scad
[1,2] ++ [3,4]       // → [1, 2, 3, 4]
"hello" ++ " world"  // → "hello world"
```

---

## Part 10: Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `pi` | 3.14159265... | Mathematical constant π |
| `PI` | 3.14159265... | Same as `pi` (alias) |
| `true` | Boolean true | — |
| `false` | Boolean false | — |
| `undef` | Undefined | Absence of a value |

---

## Part 11: Special Variables

| Variable | Description |
|----------|-------------|
| `$fn` | Number of facets for circular approximations. Used in `circle`, `cylinder`. Default is smooth. Values ≥ 3 create regular polygons/prisms. |
| `$quality` | Global mesh quality multiplier. Higher values give finer meshes but slower rendering. |
| `$res` | Explicit resolution override (advanced; overrides `$quality`). |

---

## Part 12: Language Constructs

### Variable Assignment

```scad
variable_name = expression;
```

Variables are assigned in the current scope. In ImplicitCAD (unlike standard OpenSCAD), variables **can be reassigned** in loops.

---

### `if` / `else`

```scad
if (condition) {
    // true branch
} else {
    // false branch (optional)
}
```

---

### `module` Definition

Defines a reusable named module (function that produces geometry).

```scad
module name(param1, param2=default) {
    // body using params
    child_objects;
}
name(value1, value2);  // call it
```

---

### `function` Definition / Lambda

Defines a pure function (no geometry side-effects). Functions are first-class values.

```scad
function name(x, y) = expression;
name = function(x) x * 2;           // lambda assignment
f = function(x, y) x + y;
```

---

### `let` Expressions

Introduces local variable bindings in an expression. **ImplicitCAD extension**.

```scad
let (a = 5, b = 10) a * b    // → 50
result = let (r = 5) r * r;  // → 25
```

---

### `include`

Includes and executes another file in-place (like `#include` in C).

```scad
include <filename.escad>;
```

---

### `use`

Imports function and module definitions from another file, but does not execute top-level geometry.

```scad
use <filename.escad>;
```

---

### Operator Precedence (lowest to highest)

| Level | Operators | Associativity |
|-------|-----------|---------------|
| 1 | `? :` (ternary) | Right |
| 2 | `\|\|` | Left |
| 3 | `&&` | Left |
| 4 | `==`, `!=` | Left |
| 5 | `<`, `<=`, `>=`, `>` | Left |
| 6 | `+`, `-` | Left |
| 7 | `++` | Left |
| 8 | `*`, `/`, `%` | Left |
| 9 | `^` | Right |
| 10 | `!` (unary) | Prefix |
| 11 | unary `+`, `-` | Prefix |
| 12 | `let` expressions | — |

---

## Part 13: Function Currying

ImplicitCAD supports **partial function application** (currying). Calling a multi-argument function with fewer arguments than it expects returns a new function waiting for the remaining arguments.

```scad
f = max(4);      // f is now a function: x -> max(4, x)
echo(f(5));      // → 5 (because max(4,5) = 5)
echo(max(4,5));  // same result
```

This works for all built-in two-argument functions (`max`, `min`, `atan2`, `pow`, etc.) and user-defined functions.

---

## Part 14: Advanced / Internal Haskell API Features

These are features available in the Haskell API (`Graphics.Implicit.Primitives`) but not necessarily directly accessible from the scripting language:

| Haskell Function | Description |
|-----------------|-------------|
| `withRounding r obj` | Wrap an object with a rounding context |
| `outset d obj` | Offset the surface of an object outward by d |
| `complement obj` | Invert an object (interior ↔ exterior) |
| `emptySpace` | An empty (null) object |
| `fullSpace` | A completely filled space |
| `extrudeOnEdgeOf path profile` | Extrude a 2D profile along the edge of another 2D shape |
| `boxFrame b e` | A box frame (hollow rectangular frame), from IQ's SDF library |
| `link le r1 r2` | A link shape (two spheres connected by a cylinder), from IQ's SDF library |
| `rotateQ q obj` | Rotate by quaternion `q` |
| `rotate3 [yz,zx,xy] obj` | Rotate by Euler angles (radians) |
| `rotate3V angle axis obj` | Rotate by angle (radians) around axis vector |
| `transform3 m44 obj` | Apply a 4×4 affine matrix to a 3D object |
| `transform m33 obj` | Apply a 3×3 matrix to a 2D object |
| `pack2 area sep objs` | Pack 2D objects into bounding area |
| `pack3 area sep objs` | Pack 3D objects (projects to 2D footprint) |
| `slice obj` | Slice 3D object at z=0 to produce 2D cross-section |

---

## Part 15: Unsupported OpenSCAD Features

The following OpenSCAD features are **NOT supported** in ImplicitCAD and should be avoided:

| Feature | Status | Workaround |
|---------|--------|------------|
| `hull()` | Not supported | Use `union(r=N)` for smooth blending |
| `minkowski()` | Not supported | Use outset/rounding instead |
| `offset()` | Not supported | Use `outset` internally; no scripting API |
| `resize()` | Not supported | Use `scale()` instead |
| `polyhedron()` | Not supported | No direct workaround |
| `surface()` | Not supported | No direct workaround |
| `text()` | Not supported | Cannot render text |
| `import()` | Not supported in web API | No external files |
| `$fa`, `$fs` | Not supported | Use `$fn` for facet count |
| `children()` | Limited support | Avoid complex use |

---

## Part 16: Complete Example Programs

### Example: Rounded Union (2D)
```scad
union(r=14) {
    square([80,80]);
    translate([80,80]) circle(30);
}
```

### Example: Rounded Difference (3D)
```scad
difference(r=2) {
    cube([30,30,15], center=true);
    cylinder(r=10, h=20, center=true);
}
```

### Example: Variable Twist Extrusion
```scad
linear_extrude(height=40, center=true, twist(h) = 35*cos(h*2*pi/60)) {
    union(r=8) {
        circle(10);
        translate([22,0]) circle(10);
        translate([0,22]) circle(10);
        translate([-22,0]) circle(10);
        translate([0,-22]) circle(10);
    }
}
```

### Example: Rounded Extrusion with Constant Twist
```scad
linear_extrude(height=40, center=true, twist=90, r=5) {
    union(r=8) {
        circle(10, $fn=6);
        translate([22,0]) circle(10, $fn=6);
        translate([0,22]) circle(10, $fn=6);
        translate([-22,0]) circle(10, $fn=6);
        translate([0,-22]) circle(10, $fn=6);
    }
}
```

### Example: Torus and Ellipsoid
```scad
union() {
    torus(r1=20, r2=5);
    translate([0,0,30]) ellipsoid(a=10, b=15, c=8);
}
```

### Example: Rotate Extrude (Solid of Revolution)
```scad
rotate_extrude(angle=360) translate([20,0]) circle(10);
```

### Example: Function Currying and Map
```scad
f = max(4);
echo(f(5));                             // → 5
echo(map(cos, [0, pi/2, pi]));          // → [1, ~0, -1]
```

### Example: Loop with Variable Reassignment
```scad
a = 5;
for (c = [1, 2, 3]) {
    echo(c);
    a = a * c;    // variable reassignment works!
    echo(a);
}
```

### Example: Multmatrix (Rotation + Translation)
```scad
multmatrix(m = [
    [cos(PI/4), -sin(PI/4), 0, 0],
    [sin(PI/4),  cos(PI/4), 0, 30],
    [0,          0,         1, 0],
    [0,          0,         0, 1]
]) {
    cylinder(r=10, h=10);
    cube([10,10,10]);
}
```

### Example: Mirror
```scad
union() {
    cube(4);
    mirror([1, 0, 0]) translate([2, 2, 0]) cube(1);
    mirror([0, 1, 0]) translate([2, 2, 0]) cube(2);
    mirror([1, 1, 0]) cube(3);
}
```

### Example: Shell (Hollow Object)
```scad
shell(w=2) {
    union(r=3) {
        cube([20,20,10], center=true);
        cylinder(h=25, r=8, center=true);
    }
}
```

### Example: Unit Conversion
```scad
unit("inch") {
    cube([2, 3, 1]);    // 2 inch × 3 inch × 1 inch (converted to mm internally)
}
```

---

## Summary: ImplicitCAD vs OpenSCAD Feature Comparison

| Feature | OpenSCAD | ImplicitCAD |
|---------|----------|-------------|
| `sphere`, `cube`, `cylinder` | ✓ | ✓ |
| `square`, `circle`, `polygon` | ✓ | ✓ |
| `union`, `difference`, `intersection` | ✓ | ✓ |
| `translate`, `rotate`, `scale`, `mirror` | ✓ | ✓ |
| `multmatrix` | ✓ | ✓ |
| `linear_extrude`, `rotate_extrude` | ✓ | ✓ |
| `for`, `if`, `module`, `function` | ✓ | ✓ |
| `include`, `use` | ✓ | ✓ (except web API) |
| `torus(r1, r2)` | ✗ | ✓ |
| `ellipsoid(a, b, c)` | ✗ | ✓ |
| `cone(r, h)` | ✗ | ✓ |
| `union(r=N)` rounded CSG | ✗ | ✓ |
| `cube(..., r=N)` rounded edges | ✗ | ✓ |
| `linear_extrude(..., r=N)` | ✗ | ✓ |
| `linear_extrude(twist(h)=f)` | ✗ | ✓ |
| `shell(w=N)` | ✗ | ✓ |
| `pack(size, sep)` | ✗ | ✓ |
| `unit("inch")` | ✗ | ✓ |
| `projection(cut=true)` | ✓ | ✓ (cut only) |
| `^` exponentiation operator | ✗ (`pow()`) | ✓ |
| `++` concatenation | ✗ (`concat()`) | ✓ |
| `let` expressions | ✓ | ✓ |
| Variable reassignment in loops | ✗ | ✓ |
| Function currying | ✗ | ✓ |
| `map(f, list)` | ✗ | ✓ |
| Trig functions in degrees | ✓ | ✗ (radians!) |
| `hull()` | ✓ | ✗ |
| `minkowski()` | ✓ | ✗ |
| `offset()` | ✓ | ✗ |
| `resize()` | ✓ | ✗ |
| `polyhedron()` | ✓ | ✗ |
| `text()` | ✓ | ✗ |
| `$fa`, `$fs` | ✓ | ✗ (use `$fn`) |
