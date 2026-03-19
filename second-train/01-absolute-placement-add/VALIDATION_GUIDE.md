# 如何自检 01-absolute-placement-add 的 20 个任务

本指南帮助你快速验证每个任务中生成的文件是否正确。我们有 4 个主要检查点。

---

## 📋 **检查点 1：文件结构完整性**

### 每个任务应该有这 10 个文件：
```
task-name/
├── README.md                    (任务说明)
├── llm-input/
│   ├── prompt.txt              (自然语言问题)
│   └── model.scad              (初始场景)
└── expected/
    ├── expected-scad.txt       (期望答案)
    ├── initial.stl             (初始网格)
    ├── expected.stl            (完成网格)
    ├── initial-sdf             (初始符号描述)
    ├── expected-sdf            (完成符号描述)
    ├── initial-admesh          (网格分析 - TODO)
    └── expected-admesh         (网格分析 - TODO)
```

**快速检查命令：**
```bash
# 检查某个任务是否有所有 10 个文件
cd 01-cube-at-origin/01-cube-corner-xyz-size
find . -type f | wc -l  # 应该输出 10
```

---

## 🔍 **检查点 2：SCAD 代码逻辑**

### 验证 `expected-scad.txt` 是否正确

**规则：**
- `expected-scad.txt` = initial model + 新加的 primitive

### 示例检查（以 01-cube-corner-xyz-size 为例）：

```bash
# 1. 看初始模型
cat llm-input/model.scad
# 输出应该是：
# union() {
#   translate([10, 0, 0]) sphere(r=1.2);
# }

# 2. 看期望答案
cat expected/expected-scad.txt
# 输出应该是：
# union() {
#   translate([10, 0, 0]) sphere(r=1.2);
#   translate([0, 0, 0]) cube(size=[4,5,6], center=false);
# }

# 3. 检查 ✅：
# - 初始几何被完整保留？
# - 新 primitive 正确添加了？
# - union() 语法正确？
```

**快速脚本验证所有任务的代码逻辑：**
```bash
#!/bin/bash
cd /Users/aceyang/Downloads/csc398/ImplicitCAD-Winter2026/second-train/01-absolute-placement-add

for task_dir in */*/; do
    echo "=== $(basename $task_dir) ==="
    
    # 检查 expected-scad.txt 是否包含 union() { ... }
    if grep -q "^union()" "$task_dir/expected/expected-scad.txt"; then
        echo "✓ Syntax OK"
    else
        echo "✗ SYNTAX ERROR"
    fi
    
    # 检查是否有新加的 primitive
    initial_lines=$(grep -o "translate" "$task_dir/llm-input/model.scad" | wc -l)
    expected_lines=$(grep -o "translate" "$task_dir/expected/expected-scad.txt" | wc -l)
    
    if [ $expected_lines -gt $initial_lines ]; then
        echo "✓ New primitive added"
    else
        echo "⚠ No new primitives detected"
    fi
    echo
done
```

---

## 📊 **检查点 3：STL 文件有效性**

### 验证 STL 文件是否有效生成

**STL 文件应该是二进制文件（不是文本）**

```bash
# 检查文件类型和大小
cd 01-cube-at-origin/01-cube-corner-xyz-size/expected
file initial.stl      # 应该显示 "data" (binary)
file expected.stl     # 应该显示 "data" (binary)

ls -lh *.stl          # 检查大小，应该 > 1 KB
```

**预期大小范围：**
- `initial.stl`: 50 KB ~ 500 KB（取决于几何复杂度）
- `expected.stl`: 50 KB ~ 500 KB

**逐任务检查脚本：**
```bash
#!/bin/bash
cd /Users/aceyang/Downloads/csc398/ImplicitCAD-Winter2026/second-train/01-absolute-placement-add

echo "=== STL File Validity Check ==="
for task_dir in */*/expected; do
    task_name=$(dirname "$task_dir")
    
    for stl in "$task_dir"/*.stl; do
        if [ -f "$stl" ]; then
            size=$(stat -f "%z" "$stl" 2>/dev/null | numfmt --to=iec 2>/dev/null || stat -f "%z" "$stl")
            file_type=$(file "$stl")
            
            if echo "$file_type" | grep -q "data"; then
                echo "✓ $(basename $task_dir/$stl): $size (binary)"
            else
                echo "✗ $(basename $task_dir/$stl): NOT binary"
            fi
        fi
    done
done
```

---

## 🔤 **检查点 4：SDF 符号描述验证**

### 验证 SDF 文件格式和内容

**SDF 文件应该有 3 行：**
```
[line 1] resolution 0.109...
[line 2] union [translate ... sphere ... cube ...]
[line 3] <<ghc: ... >>
```

**检查脚本：**
```bash
#!/bin/bash
cd /Users/aceyang/Downloads/csc398/ImplicitCAD-Winter2026/second-train/01-absolute-placement-add

echo "=== SDF Format Check ==="
for sdf in $(find . -name "*-sdf"); do
    echo "File: $sdf"
    
    line_count=$(wc -l < "$sdf")
    echo "  Lines: $line_count (should be 3)"
    
    # Check each line
    if head -1 "$sdf" | grep -q "^resolution"; then
        echo "  ✓ Line 1: resolution OK"
    else
        echo "  ✗ Line 1: Missing resolution"
    fi
    
    if sed -n '2p' "$sdf" | grep -q "^union"; then
        echo "  ✓ Line 2: union expression OK"
    else
        echo "  ✗ Line 2: Missing union expression"
    fi
    
    if tail -1 "$sdf" | grep -q "<<ghc:"; then
        echo "  ✓ Line 3: GHC stats OK"
    else
        echo "  ✗ Line 3: Missing GHC stats"
    fi
done
```

### 关键验证：expected-sdf 应该是 initial-sdf 的超集

```bash
# 对于每个任务，检查：
# expected-sdf 的 union 行是否包含 initial-sdf 的所有内容 + 新 primitive

cd 01-cube-at-origin/01-cube-corner-xyz-size/expected

# 比如初始有：translate (V3 10.0 0.0 0.0) (sphere 1.2)
# 期望应该有: ... sphere 1.2 ..., ... cube ...

echo "Initial SDF union line:"
sed -n '2p' initial-sdf | head -c 100
echo "..."

echo "Expected SDF union line:"
sed -n '2p' expected-sdf | head -c 100
echo "..."
```

---

## 🎯 **完整自检清单（快速版）**

运行这个脚本，一次性验证所有 20 个任务：

```bash
#!/bin/bash
BASE="/Users/aceyang/Downloads/csc398/ImplicitCAD-Winter2026/second-train/01-absolute-placement-add"
cd "$BASE"

PASS=0
FAIL=0

echo "========== FULL VALIDATION REPORT =========="
echo

for task_dir in */*/; do
    task_name="$(basename $(dirname $task_dir))/$(basename $task_dir)"
    
    # 检查文件数
    file_count=$(find "$task_dir" -type f | wc -l)
    
    # 检查 STL 文件
    stl_count=$(find "$task_dir/expected" -name "*.stl" | wc -l)
    
    # 检查 SDF 文件
    sdf_count=$(find "$task_dir/expected" -name "*-sdf" | wc -l)
    
    # 判断是否通过
    if [ $file_count -eq 10 ] && [ $stl_count -eq 2 ] && [ $sdf_count -eq 2 ]; then
        echo "✓ $task_name (files: $file_count, STL: $stl_count, SDF: $sdf_count)"
        PASS=$((PASS+1))
    else
        echo "✗ $task_name (files: $file_count, STL: $stl_count, SDF: $sdf_count)"
        FAIL=$((FAIL+1))
    fi
done

echo
echo "========== SUMMARY =========="
echo "PASS: $PASS / 20"
echo "FAIL: $FAIL / 20"
```

---

## 🚨 **常见问题排查**

### 问题 1：SDF 文件缺失或内容是 TODO
**原因：** torus 和 polygon 任务的 union 表达式可能格式不同
**解决：** 手动检查日志文件看是否有 union 行的不同格式

### 问题 2：STL 文件大小异常小（< 1 KB）
**原因：** 文件没有正确生成，可能是 expected-scad.txt 有语法错误
**解决：** 
```bash
# 尝试手动编译
/Users/aceyang/Downloads/csc398/ImplicitCAD/dist-newstyle/build/aarch64-osx/ghc-9.6.3/implicit-0.4.1.0/x/extopenscad/build/extopenscad/extopenscad \
  -o /tmp/test.stl \
  path/to/expected-scad.txt
```

### 问题 3：某个分组的任务文件不完整
**排查：** 使用快速检查脚本确定是哪个任务有问题

---

## ✅ **验证通过标准**

一个任务 ✅ 通过验证，需要满足：

1. ✅ **文件完整性**：10 个文件都存在
2. ✅ **SCAD 逻辑**：expected-scad.txt 包含 initial model + 新 primitive
3. ✅ **STL 有效**：initial.stl 和 expected.stl 都是二进制，> 1 KB
4. ✅ **SDF 有效**：initial-sdf 和 expected-sdf 都有 3 行格式
5. ✅ **SDF 正确性**：expected-sdf 的 union 包含 expected 几何

---

## 📈 **最后：统计总结**

```bash
cd /Users/aceyang/Downloads/csc398/ImplicitCAD-Winter2026/second-train/01-absolute-placement-add

echo "=== 01-absolute-placement-add Summary ==="
echo "Total tasks: $(find . -maxdepth 2 -type d | grep -E '[0-9]+-[a-z].*_[0-9]' | wc -l)"
echo "Total files: $(find . -type f | wc -l)"
echo "Total size: $(du -sh . | awk '{print $1}')"
echo
echo "By group:"
for group in 0[1-6]-*; do
    count=$(ls -d "$group"/*/ 2>/dev/null | wc -l)
    size=$(du -sh "$group" | awk '{print $1}')
    echo "  $group: $count tasks ($size)"
done
```

---

祝你验证顺利！有任何问题都可以用这些脚本来快速定位。
