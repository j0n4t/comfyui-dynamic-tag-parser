import json
import re
import random

class AnyType(str):
    """Wildcard type matching any ComfyUI slot type during validation."""
    def __ne__(self, __value: object) -> bool:
        return False

    def __eq__(self, __value: object) -> bool:
        return True

any_type = AnyType("*")

class DynamicTagParser:
    def __init__(self):
        # Dictionary to track the current index of 'list_cycle' modes across executions[cite: 1]
        self.cycle_states = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "optional": {
                "text": ("STRING", {
                    "forceInput": True,
                    "default": ""
                }),
                "tags_config": ("STRING", {
                    "default": "[]",
                    "multiline": False,
                    "hidden": True
                }),
            }
        }
        
    @classmethod
    def IS_CHANGED(cls, text, tags_config="[]"):
        # Forces ComfyUI to re-evaluate the node every run IF dynamic modes are in use[cite: 1]
        try:
            configs = json.loads(tags_config)
            for config in configs:
                if config.get("defaultMode", "fixed") != "fixed":
                    return float("NaN")
        except Exception:
            pass
        return text

    RETURN_TYPES = ("STRING",) + (any_type,) * 256
    RETURN_NAMES = ("clean_string",) + tuple(f"tag_output_{i}" for i in range(1, 257))
    FUNCTION = "parse_tags"
    CATEGORY = "utils/text"

    def _generate_default(self, default_val, default_mode, tag_name, val_type):
        """Processes the configured default string based on the chosen mode[cite: 1]."""
        if default_mode == "fixed":
            return default_val

        if default_mode == "random_range":
            try:
                parts = [x.strip() for x in default_val.split(",")]
                if len(parts) == 2:
                    min_val = float(parts[0])
                    max_val = float(parts[1])
                    if val_type == "INT":
                        return str(random.randint(int(min_val), int(max_val)))
                    else:
                        return str(random.uniform(min_val, max_val))
            except Exception:
                pass
            return default_val

        if default_mode in ("list_random", "list_cycle"):
            items = [x.strip() for x in default_val.split(",") if x.strip()]
            if not items:
                return default_val

            if default_mode == "list_random":
                return random.choice(items)
            else: # list_cycle
                if tag_name not in self.cycle_states:
                    self.cycle_states[tag_name] = 0
                idx = self.cycle_states[tag_name] % len(items)
                self.cycle_states[tag_name] += 1
                return items[idx]

        return default_val

    def parse_tags(self, text: str = "", tags_config: str = "[]"):
        clean_text = text

        try:
            configs = json.loads(tags_config)
        except Exception:
            configs = []

        parsed_values = []

        for config in configs:
            tag_name = config.get("name", "").strip()
            val_type = config.get("type", "STRING").upper()
            default_val = config.get("default", "")
            default_mode = config.get("defaultMode", "fixed")

            if not tag_name:
                continue

            pattern = fr'<{re.escape(tag_name)}:\s*([^>]+)>'
            
            # Find all occurrences of the tag in the text
            matches = list(re.finditer(pattern, clean_text, re.IGNORECASE))

            if matches:
                # Extract the value from the LAST match
                raw_val = matches[-1].group(1).strip()
                # Remove all occurrences of the tag from the clean_text
                clean_text = re.sub(pattern, '', clean_text, flags=re.IGNORECASE)
            else:
                # Trigger the generation logic if the tag was not found in the string
                raw_val = self._generate_default(default_val, default_mode, tag_name, val_type)

            # Pass raw_val as both the target to cast, and the ultimate fallback[cite: 2]
            value = self._cast_value(raw_val, val_type, raw_val)
            parsed_values.append(value)

        # -------------------------------------------------------------
        # ENHANCED COMMA & WHITESPACE CLEANUP
        # -------------------------------------------------------------
        clean_text = re.sub(r'\s*,\s*(?:,\s*)+', ', ', clean_text)
        clean_text = re.sub(r'^\s*,\s*', '', clean_text)
        clean_text = re.sub(r'\s*,\s*$', '', clean_text)
        clean_text = re.sub(r' {2,}', ' ', clean_text).strip()

        return (clean_text, *parsed_values)

    def _cast_value(self, value, val_type, default_val):
        try:
            if val_type == "INT":
                return int(float(value))
            elif val_type == "FLOAT":
                return float(value)
            elif val_type == "BOOLEAN":
                if isinstance(value, bool):
                    return value
                return str(value).lower() in ("true", "1", "yes", "on")
            else:
                return str(value)
        except (ValueError, TypeError):
            try:
                if val_type == "INT":
                    return int(default_val)
                elif val_type == "FLOAT":
                    return float(default_val)
                elif val_type == "BOOLEAN":
                    return str(default_val).lower() in ("true", "1", "yes", "on")
            except Exception:
                pass
            return str(default_val)

NODE_CLASS_MAPPINGS = {
    "DynamicTagParser": DynamicTagParser
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "DynamicTagParser": "Dynamic Tag Parser"
}