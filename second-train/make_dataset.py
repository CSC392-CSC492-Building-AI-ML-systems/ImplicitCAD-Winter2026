import os
import json

ROOT = os.getcwd()
OUT_FILE = "scad_sft_dataset.jsonl"

samples = []

for dirpath, dirnames, filenames in os.walk(ROOT):
    prompt_path = os.path.join(dirpath, "llm-input", "prompt.txt")
    model_path = os.path.join(dirpath, "llm-input", "model.scad")
    expected_path = os.path.join(dirpath, "expected", "expected-scad.txt")

    if os.path.isfile(prompt_path) and os.path.isfile(model_path) and os.path.isfile(expected_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            prompt_text = f.read().strip()

        with open(model_path, "r", encoding="utf-8") as f:
            model_text = f.read().strip()

        with open(expected_path, "r", encoding="utf-8") as f:
            expected_text = f.read().strip()

        user_prompt = (
            "Task: Modify the OpenSCAD program according to the instruction.\n\n"
            "Return the full updated OpenSCAD code.\n"
            "Do not explain anything.\n\n"
            f"Instruction:\n{prompt_text}\n\n"
            f"Existing OpenSCAD:\n```scad\n{model_text}\n```"
        )

        sample = {
            "prompt": user_prompt,
            "response": expected_text
        }

        samples.append(sample)

with open(OUT_FILE, "w", encoding="utf-8") as f:
    for sample in samples:
        f.write(json.dumps(sample, ensure_ascii=False) + "\n")

print(f"Done. Wrote {len(samples)} samples to {OUT_FILE}")