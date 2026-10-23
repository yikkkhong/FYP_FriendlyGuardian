import json
import sys
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

from speech_corrector import correct_text
from scam_fallback import analyze_scam_offline

# Ensure Chinese characters are displayed correctly (without garbled text) in Windows Terminal.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"
MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"
# MODEL_NAME = "google/gemma-3-270m-it"

# use bfloat16 instead of float32 cuts CPU memory usage in half and speeds up inference
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_NAME, dtype=torch.bfloat16
)
model.eval()


def generate_with_local_ai(system_prompt: str, user_content: str, max_new_tokens: int = 64) -> str:
    """A general-purpose local model generation function, shared by all submodules"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    prompt = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    inputs = tokenizer([prompt], return_tensors="pt")

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,
        )

    response = tokenizer.decode(
        outputs[0][inputs.input_ids.shape[1]:], skip_special_tokens=True
    )
    return response.strip()


if __name__ == "__main__":
    print(json.dumps({"status": "READY"}), flush=True)

    for line in sys.stdin:
        raw_line = line.strip()
        if not raw_line:
            continue

        try:
            req = json.loads(raw_line)
            task = req.get("task")
            text = req.get("text", "")

            if task == "speech":
                res = correct_text(text, generate_with_local_ai)
                print(json.dumps({"ok": True, "result": res}, ensure_ascii=False), flush=True)
            # anti-fraud detection in an offline state
            elif task == "scam_fallback":
                matched_phone = req.get("matchedPhone", None)
                res = analyze_scam_offline(text, matched_phone, generate_with_local_ai)
                print(json.dumps({"ok": True, "result": res}, ensure_ascii=False), flush=True)
            else:
                print(json.dumps({"ok": False, "error": f"Unknown task: {task}"}), flush=True)

        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)}), flush=True)