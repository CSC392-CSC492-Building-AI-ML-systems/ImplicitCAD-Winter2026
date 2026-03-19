#!/bin/bash
# Quick validation script for 01-absolute-placement-add section
# 用户可以直接运行这个脚本来快速验证所有 20 个任务

BASE="/Users/aceyang/Downloads/csc398/ImplicitCAD-Winter2026/second-train/01-absolute-placement-add"
cd "$BASE"

echo "════════════════════════════════════════────────────════════"
echo "  01-ABSOLUTE-PLACEMENT-ADD: 快速验证脚本"
echo "════════════════════════════════════════────────────────────"
echo

# ===== 检查点 1：文件完整性 =====
echo "✓ 检查点 1：文件完整性验证"
echo "────────────────────────────────────────────────────────────"

PASS=0
FAIL=0

for task_dir in */[0-9]*-*/; do
    task_path="$(basename $(dirname $task_dir))/$(basename $task_dir)"
    file_count=$(find "$task_dir" -type f | wc -l)
    
    if [ $file_count -eq 10 ]; then
        echo "  ✓ $task_path"
        PASS=$((PASS+1))
    else
        echo "  ✗ $task_path (缺 $((10 - file_count)) 个文件)"
        FAIL=$((FAIL+1))
    fi
done

echo
echo "  结果: $PASS/20 通过"
echo

# ===== 检查点 2：SCAD 语法 =====
echo "✓ 检查点 2：SCAD 代码逻辑验证"
echo "────────────────────────────────────────────────────────────"

SYNTAX_OK=0
SYNTAX_FAIL=0

for task_dir in */[0-9]*-*/; do
    task_path="$(basename $(dirname $task_dir))/$(basename $task_dir)"
    
    # 检查 expected-scad.txt 是否有 union() {
    if grep -q "^union()" "$task_dir/expected/expected-scad.txt" 2>/dev/null; then
        SYNTAX_OK=$((SYNTAX_OK+1))
    else
        echo "  ✗ $task_path: expected-scad.txt 语法错误"
        SYNTAX_FAIL=$((SYNTAX_FAIL+1))
    fi
done

echo "  结果: $SYNTAX_OK/20 语法正确"
if [ $SYNTAX_FAIL -gt 0 ]; then
    echo "  警告: $SYNTAX_FAIL 个任务有语法问题"
fi
echo

# ===== 检查点 3：STL 文件 =====
echo "✓ 检查点 3：STL 二进制文件验证"
echo "────────────────────────────────────────────────────────────"

STL_OK=0
STL_FAIL=0

for task_dir in */[0-9]*-*/expected; do
    task_path="$(basename $(dirname $task_dir))"
    
    for stl in "$task_dir"/*.stl; do
        if [ -f "$stl" ]; then
            size=$(stat -f "%z" "$stl")
            if [ $size -gt 1024 ]; then
                STL_OK=$((STL_OK+1))
            else
                echo "  ✗ $(basename $stl): 文件过小 ($size bytes)"
                STL_FAIL=$((STL_FAIL+1))
            fi
        fi
    done
done

echo "  结果: $STL_OK/40 STL 文件有效"
if [ $STL_FAIL -gt 0 ]; then
    echo "  警告: $STL_FAIL 个 STL 文件可能损坏"
fi
echo

# ===== 检查点 4：SDF 格式 =====
echo "✓ 检查点 4：SDF 格式验证"
echo "────────────────────────────────────────────────────────────"

SDF_OK=0
SDF_FAIL=0

for sdf in $(find . -name "*-sdf"); do
    lines=$(wc -l < "$sdf")
    
    if [ $lines -eq 3 ]; then
        # 检查三行的格式
        if head -1 "$sdf" | grep -q "^resolution" && \
           sed -n '2p' "$sdf" | grep -q "^union" && \
           tail -1 "$sdf" | grep -q "<<ghc:"; then
            SDF_OK=$((SDF_OK+1))
        else
            echo "  ✗ $(basename $sdf): 格式不正确"
            SDF_FAIL=$((SDF_FAIL+1))
        fi
    else
        echo "  ✗ $(basename $sdf): 不是 3 行 ($lines 行)"
        SDF_FAIL=$((SDF_FAIL+1))
    fi
done

echo "  结果: $SDF_OK/40 SDF 文件格式正确"
if [ $SDF_FAIL -gt 0 ]; then
    echo "  警告: $SDF_FAIL 个 SDF 文件格式有问题"
fi
echo

# ===== 总体统计 =====
echo "════════════════════════════════════════════════════════════"
echo "                      总体统计"
echo "════════════════════════════════════════════════════════════"

TOTAL_FILES=$(find . -type f | wc -l)
TOTAL_SIZE=$(du -sh . | awk '{print $1}')
STL_COUNT=$(find . -name "*.stl" | wc -l)
SDF_COUNT=$(find . -name "*-sdf" | wc -l)

echo
echo "  总任务数: 20 ✓"
echo "  任务通过率: $PASS/20 ✓"
echo "  文件总数: $TOTAL_FILES"
echo "  总大小: $TOTAL_SIZE"
echo "  STL 文件: $STL_COUNT 个"
echo "  SDF 文件: $SDF_COUNT 个"
echo

echo "════════════════════════════════════════════════════════════"

# ===== 最终评分 =====
OVERALL_SCORE=$((PASS + SYNTAX_OK + STL_OK + SDF_OK))
OVERALL_TOTAL=80

if [ $OVERALL_SCORE -ge 75 ]; then
    echo "  ✓ 整体评分: ${OVERALL_SCORE}/80 (优秀)"
elif [ $OVERALL_SCORE -ge 60 ]; then
    echo "  ⚠ 整体评分: ${OVERALL_SCORE}/80 (良好，有待改进)"
else
    echo "  ✗ 整体评分: ${OVERALL_SCORE}/80 (需要修复)"
fi

echo "════════════════════════════════════════════════════════════"
echo

echo "💡 详细检查指南请阅读: VALIDATION_GUIDE.md"
echo "📖 用法："
echo "   - 查看某个任务: cat 01-cube-at-origin/01-cube-corner-xyz-size/README.md"
echo "   - 验证代码逻辑: diff expected/expected-scad.txt llm-input/model.scad"
echo "   - 检查 SDF: cat expected/expected-sdf | head -1"
echo
