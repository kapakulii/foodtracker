import sys
import os
import re
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient


def get_app():
    from app.main import app
    return app


client = TestClient(get_app())


def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "app": "FoodTracker"}


def test_index_serve():
    r = client.get("/")
    assert r.status_code == 200
    assert "<title>FoodTracker</title>" in r.text


def test_js_modules_serve():
    for path in ["/js/app.js", "/js/state.js", "/js/utils.js", "/js/api.js",
                 "/js/ui/render.js", "/js/ui/meals.js", "/js/ui/ai-chat.js",
                 "/js/ui/auth.js", "/js/ui/tabs.js", "/js/ui/animation.js"]:
        r = client.get(path)
        assert r.status_code == 200, f"{path} returned {r.status_code}"
        assert len(r.text) > 10, f"{path} is empty"


def test_js_modules_import_names():
    """Check all named imports in JS modules resolve to actual exports."""
    import re

    module_dir = os.path.join(os.path.dirname(__file__), "..", "static", "js")
    mod_cache = {}

    def read_module(path):
        if path not in mod_cache:
            with open(path) as f:
                mod_cache[path] = f.read()
        return mod_cache[path]

    def resolve_exports(filepath):
        """Return set of all names exported by a JS module."""
        source = read_module(filepath)
        exports = set()
        for m in re.finditer(r'export\s+(?:async\s+)?function\s+(\w+)', source):
            exports.add(m.group(1))
        for m in re.finditer(r'export\s+(?:async\s+)?const\s+(\w+)', source):
            exports.add(m.group(1))
        for m in re.finditer(r'export\s+class\s+(\w+)', source):
            exports.add(m.group(1))
        # named export list like: export { foo, bar }
        for m in re.finditer(r'export\s*\{\s*([^}]+)\s*\}', source):
            for name in m.group(1).split(","):
                name = name.strip()
                if name:
                    exports.add(name)
        return exports

    def resolve_imports(filepath):
        """Return list of (imported_names, source_module_path) for a JS module."""
        source = read_module(filepath)
        imports = []
        for m in re.finditer(r'import\s*\{\s*([^}]+)\s*\}\s*from\s*["\']([^"\']+)["\']', source):
            names = [n.strip() for n in m.group(1).split(",")]
            imports.append((names, m.group(2)))
        return imports

    all_errors = []
    for root, dirs, files in os.walk(module_dir):
        for fname in files:
            if not fname.endswith(".js"):
                continue
            fpath = os.path.join(root, fname)
            rel_path = os.path.relpath(fpath, module_dir)
            for names, source_ref in resolve_imports(fpath):
                source_path = os.path.normpath(os.path.join(os.path.dirname(fpath), source_ref))
                if not os.path.isfile(source_path):
                    all_errors.append(f"{rel_path}: cannot resolve '{source_ref}' -> {source_path}")
                    continue
                exports = resolve_exports(source_path)
                for name in names:
                    if name not in exports:
                        all_errors.append(
                            f"{rel_path}: import '{name}' not found in '{source_ref}' "
                            f"(exports: {sorted(exports)})"
                        )

    if all_errors:
        pytest.fail("\n".join(all_errors))



