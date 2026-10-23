# ---- Code before load model from other script ----
# ---- Keep here as speech corrector now not very accurate ----
# ---- need to improve in future ----

# import json
# import sys
# import torch
# from transformers import AutoModelForCausalLM, AutoTokenizer

# # Ensure stdout uses UTF-8 to prevent terminal encoding issues on Windows
# if hasattr(sys.stdout, "reconfigure"):
#     sys.stdout.reconfigure(encoding="utf-8")

# # Lightweight model: Qwen2.5-0.5B-Instruct (runs fast on CPU)
# MODEL_NAME = "Qwen/Qwen2.5-0.5B-Instruct"

# tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
# model = AutoModelForCausalLM.from_pretrained(
#     MODEL_NAME, dtype=torch.float32
# )

# SYSTEM_PROMPT = (
#     "You are a specialized ASR phonetic error corrector for an anti-scam and security assistant.\n"
#     "TASK:\n"
#     "Only fix phonetic mishearings and homophones related to scams, security, banking, and authentication "
#     "(e.g., 'scan/script' -> 'scam', 'own thing/tee pee' -> 'OTP', 'tech' -> 'TAC', 'skam' -> 'scam').\n"
#     "STRICT RULES:\n"
#     "1. DO NOT improve grammar or tense (keep 'someone tell me', do NOT change to 'someone told me').\n"
#     "2. DO NOT replace words with synonyms (keep 'check', do NOT change to 'verify').\n"
#     "3. Keep every original word unless it is an obvious acoustic typo in this context.\n"
#     "4. Output ONLY the corrected text without any punctuation changes or explanation.\n\n"
#     "EXAMPLES:\n"
#     "Input: I want to check a script that someone tell me to send my own thing\n"
#     "Output: I want to check a scam that someone tell me to send my OTP\n\n"
#     "Input: verify this scan message asking for tech number\n"
#     "Output: verify this scam message asking for TAC number\n"
# )


# def correct_text(raw_text: str) -> str:
#     raw_text = raw_text.strip()
#     if not raw_text:
#         return ""

#     messages = [
#         {"role": "system", "content": SYSTEM_PROMPT},
#         {"role": "user", "content": f"Input: {raw_text}\nOutput:"},
#     ]

#     prompt = tokenizer.apply_chat_template(
#         messages, tokenize=False, add_generation_prompt=True
#     )
#     inputs = tokenizer([prompt], return_tensors="pt")

#     with torch.no_grad():
#         outputs = model.generate(
#             **inputs,
#             max_new_tokens=64,
#             do_sample=False,
#             temperature=0.0,
#         )

#     response = tokenizer.decode(
#         outputs[0][inputs.input_ids.shape[1] :], skip_special_tokens=True
#     )

#     # Clean up output to prevent the model from repeating "Output:" prefix
#     clean_response = response.replace("Output:", "").strip()
#     return clean_response

# if __name__ == "__main__":
#     # Signal to Node.js that the model is loaded into memory
#     print(json.dumps({"status": "READY"}), flush=True)

#     # Process text inputs streamed line-by-line via stdin
#     for line in sys.stdin:
#         text = line.strip()
#         if not text:
#             continue

#         corrected = correct_text(text)
#         print(json.dumps({"corrected_text": corrected}, ensure_ascii=False), flush=True)


# ---- Code load model from other script ----

SYSTEM_PROMPT = (
    "You are a specialized ASR phonetic error corrector for an anti-scam and security assistant.\n"
    "TASK:\n"
    "Only fix phonetic mishearings and homophones related to scams, security, banking, and authentication "
    "(e.g., 'scan/script' -> 'scam', 'own thing/tee pee' -> 'OTP', 'tech' -> 'TAC', 'skam' -> 'scam').\n"
    "STRICT RULES:\n"
    "1. DO NOT improve grammar or tense (keep 'someone tell me', do NOT change to 'someone told me').\n"
    "2. DO NOT replace words with synonyms (keep 'check', do NOT change to 'verify').\n"
    "3. Keep every original word unless it is an obvious acoustic typo in this context.\n"
    "4. Output ONLY the corrected text without any punctuation changes or explanation.\n\n"
    "EXAMPLES:\n"
    "Input: I want to check a script that someone tell me to send my own thing\n"
    "Output: I want to check a scam that someone tell me to send my OTP\n\n"
    "Input: verify this scan message asking for tech number\n"
    "Output: verify this scam message asking for TAC number\n"
)


# use loaded model
def correct_text(raw_text: str, generate_fn) -> str:
    raw_text = raw_text.strip()
    if not raw_text:
        return ""

    user_content = f"Input: {raw_text}\nOutput:"
    response = generate_fn(SYSTEM_PROMPT, user_content, max_new_tokens=64)

    # Clean up output to prevent the model from repeating "Output:" prefix
    clean_response = response.replace("Output:", "").strip()
    return clean_response