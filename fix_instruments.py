import re

with open("backend/app/dsp/instruments.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace the implementations of the ingredients
replacements = {
    "cheese": """def cheese(n: int = C.FRAME, f0: float = 6.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    s = np.sin(2.0 * np.pi * f0 * t)
    s_clamped = np.clip(s, -1.0, 1.0)
    y = (2.0 / np.pi) * np.arcsin(s_clamped)
    return y.astype(np.float32)""",

    "sugar": """def sugar(n: int = C.FRAME, f0: float = 5.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    y = np.sign(np.sin(2.0 * np.pi * f0 * t))
    return y.astype(np.float32)""",

    "salt": """def salt(n: int = C.FRAME, f0: float = 12.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    y = 0.4 * np.sign(np.sin(2.0 * np.pi * f0 * t))
    return y.astype(np.float32)""",

    "bread": """def bread(n: int = C.FRAME, f0: float = 3.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    f1 = f0
    f2 = f1 * 3.0
    y = 0.8 * np.sin(2.0 * np.pi * f1 * t) + 0.6 * np.sin(2.0 * np.pi * f2 * t)
    return y.astype(np.float32)""",

    "bun": """def bun(n: int = C.FRAME, f0: float = 0.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    x = -5.0 + t * 10.0
    y = 1.0 / (1.0 + x**2)
    return y.astype(np.float32)""",

    "patty": """def patty(n: int = C.FRAME, f0: float = 2.0) -> np.ndarray:
    t = 2.0 * np.pi + (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = np.sin(t)
    return y.astype(np.float32)""",

    "lettuce": """def lettuce(n: int = C.FRAME, f0: float = 3.0) -> np.ndarray:
    t = -8.0 * np.pi + (np.arange(n) / (n - 1)) * 16.0 * np.pi
    y = (np.sin(t) + 0.3 * np.sin(8.0 * t)) / 1.3
    return y.astype(np.float32)""",

    "tomato": """def tomato(n: int = C.FRAME, f0: float = 5.0) -> np.ndarray:
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = -(2.0 + 0.2 * np.sin(t)) * np.sin(t) / 2.2
    return y.astype(np.float32)""",

    "onion": """def onion(n: int = C.FRAME, f0: float = 6.0) -> np.ndarray:
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = (2.5 + 0.3 * np.cos(t)) * np.sin(t) / 2.8
    return y.astype(np.float32)""",

    "carrot": """def carrot(n: int = C.FRAME, f0: float = 4.5) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    x = 4.0 * np.pi * t
    y = np.tanh(4.0 * np.cos(x))
    return y.astype(np.float32)""",

    "cucumber": """def cucumber(n: int = C.FRAME, f0: float = 7.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    x = 4.0 * np.pi * t
    y = np.tanh(4.0 * np.cos(x))
    return y.astype(np.float32)""",

    "sauce": """def sauce(n: int = C.FRAME, f0: float = 4.0) -> np.ndarray:
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = (2.0 + np.sin(5.0 * t)) * np.sin(t) / 3.0
    return y.astype(np.float32)""",

    "egg": """def egg(n: int = C.FRAME, f0: float = 4.0) -> np.ndarray:
    t = (np.arange(n) / (n - 1)) * 6.0 * np.pi
    y = -(2.0 + 0.2 * np.sin(t)) * np.sin(t) / 2.2
    return y.astype(np.float32)""",

    "milk": """def milk(n: int = C.FRAME, f0: float = 440.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    y = np.sin(2.0 * np.pi * f0 * t)
    return y.astype(np.float32)""",

    "flour": """def flour(n: int = C.FRAME, f0: float = 300.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    y = np.sin(2.0 * np.pi * f0 * t)
    return y.astype(np.float32)""",

    "butter": """def butter(n: int = C.FRAME, f0: float = 220.0) -> np.ndarray:
    t = np.arange(n) / (n - 1)
    x = -21.0 + t * 42.0
    y = np.exp(-x**2 / 100.0)
    return y.astype(np.float32)""",

    "noodles": """def noodles(n: int = C.FRAME, f0: float = 330.0) -> np.ndarray:
    t = -12.0 * np.pi + (np.arange(n) / (n - 1)) * 24.0 * np.pi
    y = (np.sin(t) + 0.2 * np.cos(3.0 * t)) / 1.2
    return y.astype(np.float32)"""
}

# The regex should match from "def NAME(" to the next "def " or "VOICES ="
for name, new_code in replacements.items():
    if name == "bun":
        # we will add it manually before VOICES if not exists
        continue
        
    pattern = r"def " + name + r"\(n: int = C\.FRAME, f0: float = [^)]+\) -> np\.ndarray:.*?return [^\n]+\n"
    content = re.sub(pattern, new_code + "\n\n", content, flags=re.DOTALL)
    
if "def bun(" not in content:
    content = content.replace("VOICES = {", replacements["bun"] + "\n\n\nVOICES = {")

# Also add bun to VOICES
if "'bun': bread," in content:
    content = content.replace("'bun': bread,", "'bun': bun,")
elif "'bun': bun," not in content:
    content = content.replace("VOICES = {", "VOICES = {\n    'bun': bun,")

with open("backend/app/dsp/instruments.py", "w", encoding="utf-8") as f:
    f.write(content)

print("Done modifying instruments.py")
