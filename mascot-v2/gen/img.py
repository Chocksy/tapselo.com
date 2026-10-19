# OpenAI Images API via curl. The key is read from the env and passed to curl on stdin
# (curl --config -), so it never appears in argv, logs or output.
import os, sys, json, base64, subprocess, time
RESP = "/tmp/img_resp_%d.json" % os.getpid()
LOG = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calls.log")
def call(kind, prompt, out, refs=(), quality=os.environ.get("IMGQ","high"), size="1024x1024"):
    cfg = f'header = "Authorization: Bearer {os.environ["OPENAI_API_KEY"]}"\n'
    if kind == "gen":
        body = json.dumps({"model": "gpt-image-1", "prompt": prompt, "size": size, "quality": quality, "background": "transparent", "output_format": "png", "n": 1, "stream": True, "partial_images": 3})
        args = ["https://api.openai.com/v1/images/generations", "-H", "Content-Type: application/json", "--data-binary", body]
    else:
        args = ["https://api.openai.com/v1/images/edits", "-F", "model=gpt-image-1", "-F", f"prompt={prompt}", "-F", f"size={size}",
                "-F", f"quality={quality}", "-F", "background=transparent", "-F", "output_format=png", "-F", "input_fidelity=high", "-F", "stream=true", "-F", "partial_images=3"]
        for p in refs: args += ["-F", f"image[]=@{p};type=image/png"]
    for attempt in range(4):
        t = time.time()
        r = subprocess.run(["curl", "-sS", "-N", "--keepalive-time", "5", "--http1.1", "--max-time", "600", "--config", "-", "-o", RESP, "-w", "%{http_code}", *args], input=cfg, capture_output=True, text=True)
        code = r.stdout.strip()
        with open(LOG, "a") as f: f.write(f"{time.strftime('%H:%M:%S')} {kind} {out} http={code or 'none'} {time.time()-t:.0f}s {r.stderr.strip()[:80]}\n")
        if code == "200": break
        if code and code != "000":
            print("ERROR", code, open(RESP).read()[:400]); sys.exit(1)
        time.sleep(5)
    else:
        sys.exit("gave up")
    final = None
    for line in open(RESP):
        if line.startswith("data: "):
            try: ev = json.loads(line[6:])
            except Exception: continue
            if ev.get("type", "").endswith(".completed"): final = ev
    if not final:
        with open(LOG, "a") as f: f.write(f"  -> stream ended without completed event\n")
        sys.exit("no completed event")
    open(out, "wb").write(base64.b64decode(final["b64_json"])); print("saved", out, final.get("background"), final.get("usage", {}).get("total_tokens"))
if __name__ == "__main__":
    kind, out, promptfile, *refs = sys.argv[1:]
    for i in range(3):
        try:
            call(kind, open(promptfile).read(), out, refs); break
        except SystemExit as e:
            if str(e) != "no completed event": raise
            time.sleep(3)
