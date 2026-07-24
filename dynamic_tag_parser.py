import json
import re


class AnyType(str):
    """Wildcard type matching any ComfyUI slot type during validation."""
    def __ne__(self, __value: object) -> bool:
        return False

    def __eq__(self, __value: object) -> bool:
        return True


any_type = AnyType("*")


class DynamicTagParser:
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {
                    "forceInput": True,
                    "default": ""
                }),
            },
            "optional": {
                "tags_config": ("STRING", {
                    "default": "[]",
                    "multiline": False,
                    "hidden": True
                }),
            }
        }

    RETURN_TYPES = ("STRING",) + (any_type,) * 256
    RETURN_NAMES = ("clean_string",) + tuple(f"tag_output_{i}" for i in range(1, 257))
    FUNCTION = "parse_tags"
    CATEGORY = "utils/text"

    def parse_tags(self, text: str, tags_config: str = "[]"):
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

            if not tag_name:
                continue

            pattern = fr'<{re.escape(tag_name)}:\s*([^>]+)>'
            match = re.search(pattern, clean_text, re.IGNORECASE)

            if match:
                raw_val = match.group(1).strip()
                clean_text = re.sub(pattern, '', clean_text, flags=re.IGNORECASE)
            else:
                raw_val = default_val

            value = self._cast_value(raw_val, val_type, default_val)
            parsed_values.append(value)

        # -------------------------------------------------------------
        # ENHANCED COMMA & WHITESPACE CLEANUP
        # -------------------------------------------------------------
        # 1. Collapse multiple consecutive commas (with optional spaces) down to a single ", "
        clean_text = re.sub(r'\s*,\s*(?:,\s*)+', ', ', clean_text)
        
        # 2. Strip leading commas and whitespace
        clean_text = re.sub(r'^\s*,\s*', '', clean_text)
        
        # 3. Strip trailing commas and whitespace
        clean_text = re.sub(r'\s*,\s*$', '', clean_text)
        
        # 4. Collapse multiple spaces down to a single space
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