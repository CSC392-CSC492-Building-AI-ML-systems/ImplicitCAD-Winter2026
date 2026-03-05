# ImplicitCAD Code Generation Reference

**CRITICAL: You must generate ImplicitCAD/ExtOpenSCAD code, NOT pure OpenSCAD.**

ImplicitCAD uses a modified OpenSCAD-like language (ExtOpenSCAD). Many OpenSCAD features differ or are unsupported. Always prefer ImplicitCAD-native features.

---

## 1. Supported 3D Primitives

| Primitive | Syntax | Notes |
|-----------|--------|-------|
| `sphere` | `sphere(r=N)` or `sphere(d=N)` | Radius or diameter |
| `cube` | `cube(N)` or `cube(size=[x,y,z], center=true/false, r=0)` | `r` rounds edges (ImplicitCAD extension). `size` may be a number or a vector. Advanced form also supports `x y z` as numbers or intervals. |
| `cylinder` | `cylinder(r=N, h=N, center=true/false, $fn=N)` | Also supports `r1 r2` for frustum (tapered cylinder), and `d d1 d2` diameter forms. `$fn` makes a prism. |
| `cone` | `cone(r=N, h=N, center=true/false)` or `cone(d=N, h=N, center=true/false)` | ImplicitCAD specific cone primitive |
| `torus` | `torus(r1=N, r2=N)` | ImplicitCAD only |
| `ellipsoid` | `ellipsoid(a=N, b=N, c=N)` | `a` required, `b` and `c` default to `a` |
| `polygon` | `polygon(points=[[x1,y1],[x2,y2],...])` | Produces a 2D polygon. Use with `linear_extrude` or `rotate_extrude` for 3D |

**NOT supported:** `polyhedron()`, `surface()`, `text()`

---

## 2. Supported 2D Primitives

| Primitive | Syntax | Notes |
|-----------|--------|-------|
| `square` | `square(N)` or `square(size=[x,y], center=true/false, r=0)` | `r` rounds corners (ImplicitCAD extension). Advanced form also supports `x` and `y` as numbers or intervals. |
| `circle` | `circle(r=N, $fn=N)` or `circle(d=N, $fn=N)` | `$fn` makes a regular polygon |
| `polygon` | `polygon(points=[[x1,y1],[x2,y2],...])` | 2D only |

---

## 3. CSG Operations

All support **rounded interfaces** (ImplicitCAD extension):

```scad
union(r=5) { sphere(10); cube(20, center=true); }   // Rounded union!
intersection(r=2) { ... }
difference(r=1) { cube(20); sphere(12); }
```

- **union(r=N)** — radius of rounding at interfaces (default 0)
- **intersection(r=N)** — rounded intersection
- **difference(r=N)** — rounded difference (first child minus rest)

**NOT supported:** `hull()`, `minkowski()`

---

## 4. Transforms

| Transform | Syntax |
|-----------|--------|
| `translate` | `translate(v=[x,y,z]) { ... }` or `translate(x=X, y=Y, z=Z) { ... }` |
| `rotate` | `rotate(a=[yz,zx,xy]) { ... }` or `rotate(a=deg, v=[x,y,z]) { ... }` (degrees) |
| `scale` | `scale(v=[x,y,z]) { ... }` or `scale(v=k) { ... }` |
| `mirror` | `mirror(v=[x,y,z]) { ... }` or `mirror(x=1, y=0, z=0) { ... }` |
| `multmatrix` | `multmatrix(m=[[...4x4...]]) { ... }` |

---

## 5. Extrusions

### linear_extrude (ImplicitCAD extended)

```scad
linear_extrude(height=N, center=true/false, twist=0, scale=1, translate=[0,0], r=0) { ... }
```

1 `height` can be a number, or a function `height(x,y)` that returns height  
2 `twist` can be a number in degrees, or a function `twist(z)`  
3 `scale` can be constant, or vary along the extrusion  
4 `translate` can be a constant 2D vector, or a function `translate(z)` returning a 2D vector  
5 `r` rounds the top and bottom edges

### rotate_extrude

```scad
rotate_extrude(angle=360, r=0, translate=[0,0], rotate=0) { ... }
```

1 `angle` is sweep in degrees  
2 `translate` can be constant, or a function of sweep parameter  
3 `rotate` can be constant, or a function of sweep parameter  
4 `r` rounds the resulting solid

---

## 6. ImplicitCAD-Only Features

- **torus(r1, r2)** — donut shape
- **ellipsoid(a, b, c)** — ellipsoid
- **cone(r, h)** — cone
- **union(r=N)**, **intersection(r=N)**, **difference(r=N)** — rounded CSG
- **cube(..., r=N)**, **square(..., r=N)** — rounded corners/edges
- **linear_extrude(..., r=N)** — rounded extrusion
- **linear_extrude(..., twist=f)** — twist as function of height
- **shell(w=N)** — hollow shell of thickness w
- **pack(size=[x,y], sep=N)** — pack objects in 2D box
- **unit("inch")** — unit conversion (inch, foot, mm, cm, etc.)
- **projection(cut=true)** — project 3D to 2D by slicing at z=0

---

## 7. NOT Supported (avoid these)

| OpenSCAD feature | Status |
|------------------|--------|
| `hull()` | **NOT supported** |
| `minkowski()` | **NOT supported** |
| `offset()` | **NOT supported** |
| `resize()` | **NOT supported** |
| `polyhedron()` | **NOT supported** |
| `surface()` | **NOT supported** |
| `text()` | **NOT supported** |
| `import()`, `include`, `use` | **Ignored in web API** — no external files |
| `children` | Limited; avoid complex use |
| `$fa`, `$fs` | Use `$fn` instead where applicable |

**Workarounds:**
- Rounded box: `cube(..., r=N)` or `union(r=N)`
- Hull-like: combine with `union(r=N)` for smooth blending where possible
- Text: not possible; use shapes to approximate

---

## 8. Language

- **for** loops: `for (i = [0:5]) { translate([i*10,0,0]) cube(5); }`
- **if/else**: `if (x>0) { ... } else { ... }`
- **module** and **function** definitions supported
- **let** expressions: `let (a=5, b=10) a*b`
- Variables can be reassigned in loops (unlike OpenSCAD)
- **Operators:** `+`, `-`, `*`, `/`, `%`, `^` (exponent), `++` (concat), `? :` (ternary)

---

## 9. Math & List Functions

- **Trig:** `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, `sinh`, `cosh`, `tanh`
- **Math:** `abs`, `sign`, `floor`, `ceil`, `round`, `sqrt`, `exp`, `ln`, `log`, `pow` (or `^`)
- **List:** `len`, `str`, `index`, `splice`, `map`, `lookup`, `rands`
- **Constants:** `pi` (or `PI`)

---

## 10. Special Variables

- **$fn** — facet count for circle/cylinder (use for hexagons: `circle(r=5, $fn=6)`)
- **$quality** — mesh density (higher = finer, slower)
- **$res** — explicit resolution (advanced)

---

## 11. Example: ImplicitCAD-Style Rounded Shape

```scad
// Rounded union — ImplicitCAD extension
union(r=3) {
    cube([20, 20, 10], center=true);
    cylinder(h=25, r=8, center=true);
}

// Rounded difference
difference(r=1) {
    cube([30, 30, 15], center=true);
    cylinder(h=20, r=10, center=true);
}
```

---

## 12. Output Rules

1. Output **ONLY** valid ImplicitCAD code. No markdown fences unless the user asks.
2. Prefer **ImplicitCAD extensions** over OpenSCAD-only patterns.
3. **Never use** `hull`, `minkowski`, `offset`, `resize`, `polyhedron`, `surface`, `text`.
4. **Never use** `import`, `include`, or `use`.
5. Use **union(r=N)** for smooth blending instead of hull when possible.
6. Use **torus** and **ellipsoid** instead of approximating with other primitives.
7. Use **cube(..., r=N)** for rounded boxes.
8. Keep code self-contained (no external file dependencies).
