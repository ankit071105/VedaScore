# fix_endpoints.py
import re
import sys
from pathlib import Path

SRC = Path("app.py")
OUT = Path("app_fixed.py")

if not SRC.exists():
    print("Error: app.py not found in current directory.")
    sys.exit(1)

text = SRC.read_text(encoding="utf-8", errors="ignore")

# Regex to find @app.route(... ) decorators (supports multi-line decorator args)
route_re = re.compile(r'@app\.route\s*\(\s*((?:.|\n)*?)\)\s*\n\s*def\s+([A-Za-z_]\w*)\s*\(', re.MULTILINE)

# We'll iterate matches in order and build a new text piecewise
seen_endpoints = {}
changes = []

def extract_endpoint_from_args(args_text):
    # Try to find endpoint= 'something' or "something"
    m = re.search(r"endpoint\s*=\s*(['\"])(.*?)\1", args_text)
    if m:
        return m.group(2)
    # else endpoint defaults to function name (we don't know yet)
    return None

def add_or_rename(endpoint, func_name, start, end, args_text):
    # endpoint could be None (no endpoint param), then default will be func_name
    current = endpoint if endpoint else func_name
    if current not in seen_endpoints:
        seen_endpoints[current] = 1
        return None  # no change needed
    # duplicate: generate unique endpoint name
    count = seen_endpoints[current] + 1
    seen_endpoints[current] = count
    new_endpoint = f"{current}_{count}"
    # We will return a tuple to replace decorator args and function name
    return new_endpoint

# We will go through matches and prepare edits
edits = []  # each edit: (start_idx_of_args, end_idx_of_args, new_args_text, func_name_start, func_name_end, new_func_name)
for m in route_re.finditer(text):
    args_text = m.group(1)
    func_name = m.group(2)
    match_start, match_end = m.span(1)  # span of the decorator args
    # extract endpoint if present
    endpoint = extract_endpoint_from_args(args_text)
    new_endpoint = add_or_rename(endpoint, func_name, match_start, match_end, args_text)
    if new_endpoint:
        # Build new args_text: insert or replace endpoint=...
        if endpoint:
            # replace the existing endpoint value
            new_args_text = re.sub(r"(endpoint\s*=\s*)['\"].*?['\"]", r"\1'"+new_endpoint+"'", args_text, count=1)
        else:
            # insert endpoint='new_endpoint' as the first kwarg or last - try to keep formatting
            # If args_text contains other args, append ", endpoint='...'"
            if args_text.strip() == "":
                new_args_text = "endpoint='" + new_endpoint + "'"
            else:
                # find insertion point before closing maybe keep newline handling
                new_args_text = args_text.rstrip() + (", " if not args_text.rstrip().endswith(",") else " ") + "endpoint='" + new_endpoint + "'"
        # we'll also rename the function, to keep the code consistent (function name -> func_name_{n})
        # Construct new function name
        unique_func_name = f"{func_name}_{seen_endpoints[endpoint if endpoint else func_name]}"
        # find exact position of the def function name (we can locate it by searching from match end)
        def_search = re.search(r'\n\s*def\s+' + re.escape(func_name) + r'\s*\(', text[m.end():])
        if def_search:
            func_name_start = m.end() + def_search.start()
            func_name_end = func_name_start + def_search.group(0).index('(')  # index of '(' point
            # store edit
            edits.append((match_start, match_end, new_args_text, func_name_start, func_name_start + len("def ") + len(func_name), unique_func_name))
            changes.append((func_name, unique_func_name, new_endpoint))
        else:
            # fallback: don't attempt func rename, only update endpoint in decorator
            edits.append((match_start, match_end, new_args_text, None, None, None))
            changes.append((func_name, None, new_endpoint))

# Apply edits in reverse order so indices don't shift
if not edits:
    print("No duplicate endpoints found by heuristic. No edits made.")
    OUT.write_text(text, encoding="utf-8")
    sys.exit(0)

new_text = text
for e in reversed(edits):
    args_s, args_e, new_args_text, fn_s, fn_e, unique_fn = e
    # replace decorator args chunk
    new_text = new_text[:args_s] + new_args_text + new_text[args_e:]
    # If function rename requested
    if fn_s is not None and unique_fn is not None:
        # Replace def function name only in the def line
        # fn_s points at start of "\n    def funcname("
        # find "def funcname" region
        # we'll do a small regex replacement in the area around fn_s to be safe
        window_start = max(0, fn_s - 40)
        window_end = min(len(new_text), fn_e + 200)
        window = new_text[window_start:window_end]
        window_modified = re.sub(r'(\bdef\s+)' + re.escape(window[window.index('def') + 4:window.index('def') + 4 + (fn_e-fn_s - 4)].split('(')[0]) , window)
        # simpler: directly replace the first occurrence of "def oldname(" after fn_s
        idx = new_text.find("def ", fn_s)
        if idx != -1:
            # find paren
            p = new_text.find("(", idx)
            if p != -1:
                # extract old name
                oldname = new_text[idx+4:p].strip()
                if oldname:
                    new_text = new_text[:idx+4] + unique_fn + new_text[p:]
        # Additionally, replace occurrences of the old function name used as endpoint (if any) in the file:
        # (We will not do wholesale global replacement to avoid wrong changes.)
        # The decorator endpoint value was already changed, so references should be minimal.

# write output
OUT.write_text(new_text, encoding="utf-8")
print(f"Wrote fixed file to {OUT}.")
print("Changes (old_func -> new_func, new_endpoint):")
for c in changes:
    print("  ", c)
print("IMPORTANT: review app_fixed.py, run your tests, and inspect any renamed functions (search for the new function names).")
