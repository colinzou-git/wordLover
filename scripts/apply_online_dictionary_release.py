from pathlib import Path

public = Path("apps/wordlover-pwa/public")
for name in ("app.js", "sw.js", "automated-tests.js"):
    path = public / name
    text = path.read_text(encoding="utf-8")
    if "wordlover-shell-v133" not in text:
        raise RuntimeError(f"{name}: shell release anchor missing")
    path.write_text(text.replace("wordlover-shell-v133", "wordlover-shell-v134"), encoding="utf-8")

app_path = public / "app.js"
app = app_path.read_text(encoding="utf-8")
old = 'const APP_VERSION = "0.6.2-product.20260618-1-v133";'
new = 'const APP_VERSION = "0.6.2-product.20260620-1-v134";'
if app.count(old) != 1:
    raise RuntimeError("app version anchor mismatch")
app_path.write_text(app.replace(old, new, 1), encoding="utf-8")
print("Updated shell release to v134")
