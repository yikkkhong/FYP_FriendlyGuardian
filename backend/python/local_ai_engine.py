import ctypes
import json
import sys

import psutil
from huggingface_hub import hf_hub_download
from huggingface_hub.errors import LocalEntryNotFoundError
from llama_cpp import Llama, LLAMA_SPLIT_MODE_NONE, llama_cpp
from llama_cpp._ctypes_extensions import load_shared_library

from speech_corrector import correct_text
from scam_fallback import analyze_scam_offline

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def select_gpu():
    """Inspect the devices exposed by the installed llama.cpp backend."""
    llama_cpp.llama_backend_init()
    # The Python binding does not yet wrap the ggml backend device API.
    ggml = load_shared_library("ggml", llama_cpp._base_path)
    base = load_shared_library("ggml-base", llama_cpp._base_path)
    pointer = ctypes.c_void_p
    size = ctypes.c_size_t
    ggml.ggml_backend_dev_count.argtypes = []
    ggml.ggml_backend_dev_count.restype = size
    ggml.ggml_backend_dev_get.argtypes = [size]
    ggml.ggml_backend_dev_get.restype = pointer
    base.ggml_backend_dev_type.argtypes = [pointer]
    base.ggml_backend_dev_type.restype = ctypes.c_int
    base.ggml_backend_dev_memory.argtypes = [pointer, ctypes.POINTER(size), ctypes.POINTER(size)]
    base.ggml_backend_dev_memory.restype = None

    gpu_index = 0
    candidates = []
    for i in range(ggml.ggml_backend_dev_count()):
        device = ggml.ggml_backend_dev_get(i)
        if base.ggml_backend_dev_type(device) != 1:  # GGML_BACKEND_DEVICE_TYPE_GPU (dedicated)
            continue
        free, total = size(), size()
        base.ggml_backend_dev_memory(device, ctypes.byref(free), ctypes.byref(total))
        if total.value >= 4 * 1024**3:
            candidates.append((free.value, gpu_index))
        gpu_index += 1
    return max(candidates)[1] if candidates else None


def load_model():
    artifact = dict(
        repo_id="bartowski/Qwen2.5-0.5B-Instruct-GGUF",
        revision="41ba88dbac95fed2528c92514c131d73eb5a174b",
        filename="Qwen2.5-0.5B-Instruct-Q4_K_M.gguf",
    )
    try:
        path = hf_hub_download(**artifact, local_files_only=True)
    except LocalEntryNotFoundError:
        path = hf_hub_download(**artifact)

    threads = psutil.cpu_count(logical=False) or 1
    options = dict(model_path=path, n_ctx=0, n_threads=threads, n_threads_batch=threads,
                   chat_format="chatml", use_mmap=False, verbose=False)
    try:
        gpu = select_gpu()
    except (OSError, RuntimeError, AttributeError) as error:
        print(f"GPU detection unavailable: {error}", file=sys.stderr)
        gpu = None
    if gpu is not None:
        try:
            return Llama(**options, n_gpu_layers=-1, split_mode=LLAMA_SPLIT_MODE_NONE,
                         main_gpu=gpu), f"GPU {gpu}"
        except (ValueError, RuntimeError, MemoryError) as error:
            print(f"GPU model load failed: {error}. Using CPU.", file=sys.stderr)
    return Llama(**options, n_gpu_layers=0, offload_kqv=False, op_offload=False), f"CPU ({threads} threads)"


def generate_with_local_ai(system_prompt: str, user_content: str, max_new_tokens: int = 64) -> str:
    response = model.create_chat_completion(
        messages=[{"role": "system", "content": system_prompt},
                  {"role": "user", "content": user_content}],
        max_tokens=max_new_tokens, temperature=0, repeat_penalty=1.0,
    )
    return response["choices"][0]["message"]["content"].strip()

if __name__ == "__main__":
    model, device = load_model()
    model.eval([model.token_bos() if model.token_bos() >= 0 else model.token_eos()])
    model.reset()
    print(json.dumps({"status": "READY", "device": device}), flush=True)

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
                res = analyze_scam_offline(text, matched_phone, generate_with_local_ai, req.get("tier", 1))
                print(json.dumps({"ok": True, "result": res}, ensure_ascii=False), flush=True)
            else:
                print(json.dumps({"ok": False, "error": f"Unknown task: {task}"}), flush=True)

        except Exception as e:
            print(json.dumps({"ok": False, "error": str(e)}), flush=True)
