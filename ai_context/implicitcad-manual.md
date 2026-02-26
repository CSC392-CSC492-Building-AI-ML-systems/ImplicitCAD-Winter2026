# ImplicitCAD Code Generation Reference

**CRITICAL: You must generate ImplicitCAD/ExtOpenSCAD code, NOT pure OpenSCAD.**

ImplicitCAD uses a modified OpenSCAD-like language (ExtOpenSCAD). Many OpenSCAD features differ or are unsupported. Always prefer ImplicitCAD-native features.

---

## 1. Supported 3D Primitives

| Primitive | Syntax | Notes |
|-----------|--------|-------|
| `sphere` | `sphere(r=N)` or `sphere(d=N)` | Radius or diameter |
| `cube` | `cube([x,y,z], center=true/false, r=0)` | **r** rounds edges (ImplicitCAD extension) |
| `cylinder` | `cylinder(r=N, h=N, center=true/false)` | Also `r1`, `r2` for cone; `$fn` for polygon |
| `cone` | `cone(r=N, h=N, center=true/false)` | ImplicitCAD-specific cone primitive |
| `torus` | `torus(r1=N, r2=N)` | **ImplicitCAD only** — OpenSCAD has no native torus |
| `ellipsoid` | `ellipsoid(a=N, b=N, c=N)` | **ImplicitCAD only** |
| `circle` | `circle(r=N)` or `circle(d=N)` | 2D; `$fn` for polygon |

**NOT supported:** `polyhedron()`, `surface()`, `text()`

---

## 2. Supported 2D Primitives

| Primitive | Syntax | Notes |
|-----------|--------|-------|
| `square` | `square([x,y], center=true/false, r=0)` | **r** rounds corners (extension) |
| `circle` | `circle(r=N, $fn=N)` | Use `$fn` for regular polygon (e.g. hexagon) |
| `polygon` | `polygon(points=[[x1,y1],[x2,y2],...])` | 2D only; no paths parameter |

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
| `translate` | `translate([x,y,z])` or `translate([x,y])` |
| `rotate` | `rotate([a,b,c])` or `rotate(a, v=[x,y,z])` — angles in degrees |
| `scale` | `scale([x,y,z])` or `scale(k)` |
| `mirror` | `mirror([x,y,z])` or `mirror(v=[x,y,z])` |
| `multmatrix` | `multmatrix(m=[[...4x4...]])` |

---

## 5. Extrusions

### linear_extrude (ImplicitCAD extended)

```scad
linear_extrude(height=N, center=true/false, twist=90, r=5) { ... }
```

- **twist** — constant degrees, OR a **function**: `twist(h) = 35*cos(h*2*pi/60)` (ImplicitCAD only)
- **scale** — scaling during extrusion
- **translate** — 2D shift during extrusion
- **r** — **rounded top/bottom** (ImplicitCAD only)

### rotate_extrude

```scad
rotate_extrude(angle=360, r=0) translate([R,0]) circle(r);
```

- **angle** — sweep in degrees (not `a`, use `angle`)
- **r** — rounding (ImplicitCAD extension)

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
