# Prompt Template

This directory contains the system prompt template used to benchmark LLMs on ImplicitCAD `.scad` code generation.

## Overview

`prompt_template.txt` is a structured system prompt that is filled in per test case and sent to an LLM. The model's response — a `.scad` file — is compiled by ImplicitCAD into an STL, which is then compared against a reference STL using `admesh` to evaluate geometry accuracy.

## Benchmark Pipeline

```
prompt_template.txt
       │
       ▼  (fill placeholders per test case)
  filled prompt
       │
       ▼  (send to LLM)
  generated .scad
       │
       ▼  (compile with ImplicitCAD)
  generated .stl
       │
       ▼  (compare with admesh)
  reference .stl  ──► score / metrics
```

Test cases live in `test_files/stl_with_admesh/`. Each folder contains:

| File | Description |
|---|---|
| `prompt.txt` | The raw (pre-template) prompt for that test case |
| `model.stl` | Reference STL produced by ImplicitCAD from the ground-truth `.scad` |
| `admesh.txt` | Admesh analysis of the reference STL (bounding box, volume, facet counts) |

## Test Case Tiers

Cases are numbered and labeled by difficulty tier:

| Tier | Description | Examples |
|---|---|---|
| `t1` | Single primitive shapes | cylinder, box, sphere, cone, torus |
| `t2` | CSG combinations, arrays, boolean ops | hollow cylinder, L-bracket, hole array |
| `t3` | Advanced features | twisted extrusion, rotate extrusion, shell, complex CSG |

## Placeholders

Before sending to an LLM, replace all `{...}` tokens:

| Placeholder | Description |
|---|---|
| `{TASK}` | The generation task (e.g., `Generate a hollow cylinder`) |
| `{EXISTING_GEOMETRY}` | Pre-existing `.scad` geometry to build upon, or `none` |
| `{SHAPE_DESCRIPTION}` | Natural language description of the shape |
| `{PARAMETER_LIST}` | Named parameters and values (e.g., `r = 15`, `h = 42`) |
| `{COORDINATE_RULES}` | Origin placement and axis orientation rules |

## Key Language Constraints

The template enforces strict ImplicitCAD (ExtOpenSCAD) rules:

- **Use `$fn`**, not `$fa` or `$fs`
- **Trig functions use radians** — `sin(pi/2)`, not `sin(90)`
- **`rotate()` uses degrees** (the parser converts automatically)
- **No `hull()`, `minkowski()`, `offset()`, `polyhedron()`, `text()`, or `import()`**
- **All parameters must be named variables** — no bare numeric literals inside primitives

## Required Output Structure

Every generated `.scad` file must follow this order:

```
1. Parameter definitions   // named variables, one per line
2. Geometry construction   // modules or inline CSG referencing those variables
3. Top-level geometry call // statement(s) that produce the final model
```

## Usage Example

```python
with open("prompt_template.txt") as f:
    template = f.read()

prompt = template \
    .replace("{TASK}", "Generate a hollow cylinder") \
    .replace("{EXISTING_GEOMETRY}", "none") \
    .replace("{SHAPE_DESCRIPTION}", "A cylinder with a coaxial cylindrical hole through its center") \
    .replace("{PARAMETER_LIST}", "outer_r = 15\ninner_r = 10\nh = 30") \
    .replace("{COORDINATE_RULES}", "Center the shape at the origin. The cylinder axis is along Z.")
```
