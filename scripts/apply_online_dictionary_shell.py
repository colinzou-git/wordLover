from pathlib import Path
import json

root = Path("apps/wordlover-pwa")
public = root / "public"

sw_path = public / "sw.js"
sw = sw_path.read_text(encoding="utf-8")
anchor = '  "/full-dictionary.js?v=20260618-1",\n'
replacement = (
    anchor
    + '  "/online-dictionary-normalize.js?v=20260618-1",\n'
    + '  "/online-dictionary.js?v=20260618-1",\n'
)
if sw.count(anchor) != 1:
    raise RuntimeError("service worker online asset anchor mismatch")
sw_path.write_text(sw.replace(anchor, replacement, 1), encoding="utf-8")

styles_path = public / "styles.css"
styles = styles_path.read_text(encoding="utf-8")
if "/* Online dictionary fallback */" not in styles:
    styles += """

/* Online dictionary fallback */
.online-dictionary-meta {
  margin: 0.85rem 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid currentColor;
  border-radius: 0.75rem;
}
.online-dictionary-meta p { margin: 0.2rem 0; }
"""
styles_path.write_text(styles, encoding="utf-8")

package_path = root / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
command = "node scripts/test-online-dictionary.mjs"
if command not in package["scripts"]["test:unit"]:
    package["scripts"]["test:unit"] += f" && {command}"
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")
print("Patched shell assets, styles, and test command")
