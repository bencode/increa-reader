#!/usr/bin/env python3
"""
Text Translator MCP Server - Translate text files with context awareness
"""

import json
from pathlib import Path

import chardet
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("text-translator")

SUPPORTED_LANGUAGES = {
    "zh-CN": "简体中文",
    "zh-TW": "繁体中文",
    "en": "English",
    "ja": "日本語",
    "ko": "한국어",
    "fr": "Français",
    "de": "Deutsch",
    "es": "Español",
    "ru": "Русский",
    "pt": "Português",
    "it": "Italiano",
}


def _read_file_with_encoding(path: str) -> str:
    """Read file with automatic encoding detection"""
    path_obj = Path(path)
    if not path_obj.exists():
        raise FileNotFoundError(f"File not found: {path}")

    raw_data = path_obj.read_bytes()
    detected = chardet.detect(raw_data)
    encoding = detected["encoding"] or "utf-8"

    return raw_data.decode(encoding, errors="replace")


def _format_numbered_paragraphs(paragraphs: list[str]) -> str:
    """Format paragraphs as a numbered list"""
    return "\n\n".join(f"{i+1}. {para}" for i, para in enumerate(paragraphs))


def _parse_numbered_translations(text: str) -> list[str]:
    """Parse numbered translation results"""
    lines = text.strip().split("\n")
    translations = []
    current_translation = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Detect numbered lines (e.g., "1. ", "2. ")
        if line[0].isdigit() and (". " in line[:5] or ") " in line[:5]):
            # Save previous translation
            if current_translation:
                translations.append(" ".join(current_translation))
                current_translation = []
            # Extract current translation (remove numbering)
            content = line.split(". ", 1)[-1] if ". " in line else line.split(") ", 1)[-1]
            current_translation.append(content)
        # Continue current translation (multiline case)
        elif current_translation or translations:
            current_translation.append(line)

    # Save last translation
    if current_translation:
        translations.append(" ".join(current_translation))

    return translations


def _parse_json_safe(text: str) -> dict:
    """Safely parse JSON, handling markdown code blocks"""
    text = text.strip()

    # Remove markdown code block markers
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if len(lines) > 2 else text

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {}


@mcp.tool()
def split_document(path: str) -> str:
    """
    Read and split document into paragraphs (using \\n\\n separator)

    Args:
        path: File path

    Returns:
        JSON: {
            "paragraphs": ["paragraph1", "paragraph2", ...],
            "total": 100
        }
    """
    text = _read_file_with_encoding(path)
    paragraphs = text.split("\n\n")

    # Filter empty paragraphs
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    return json.dumps({"paragraphs": paragraphs, "total": len(paragraphs)}, ensure_ascii=False)


@mcp.tool()
async def translate_paragraphs(
    paragraphs: list[str],
    target_lang: str,
    context: dict | None = None,
    extract_new_terms: bool = True,
) -> str:
    """
    Translate a batch of paragraphs (typically 5-10)

    Args:
        paragraphs: List of paragraphs to translate
        target_lang: Target language (zh-CN, en, ja, etc.)
        context: Context from previous translation
            {
                "glossary": {"term": "translation", ...},
                "previous_paragraphs": [
                    {"original": "...", "translation": "..."},
                    {"original": "...", "translation": "..."}
                ],
                "style_guide": {"style": "technical", "tone": "formal"}
            }
        extract_new_terms: Whether to extract new terms from this translation

    Returns:
        JSON: {
            "translations": ["translation1", "translation2", ...],
            "context": {
                "glossary": {...},
                "previous_paragraphs": [...],
                "style_guide": {...}
            },
            "stats": {
                "translated": 10,
                "new_terms": 5,
                "glossary_size": 25
            }
        }
    """
    # 1. Initialize or load context
    if context is None:
        # First translation, analyze style from current paragraphs
        style_result = await _analyze_style(paragraphs[:3], target_lang)
        glossary = style_result.get("initial_glossary", {})
        style_guide = {
            "style": style_result.get("style", "maintain original"),
            "tone": style_result.get("tone", "neutral"),
            "domain": style_result.get("domain", "general"),
        }
        previous_paragraphs = []
    else:
        glossary = context.get("glossary", {})
        previous_paragraphs = context.get("previous_paragraphs", [])
        style_guide = context.get("style_guide", {})

    # 2. Build context summary
    context_summary = ""
    if previous_paragraphs:
        context_summary = "**Previous Context (for continuity):**\n"
        for item in previous_paragraphs[-2:]:  # Last 2 paragraphs
            orig = item["original"][:80]
            trans = item["translation"][:80]
            context_summary += f"Original: {orig}...\n"
            context_summary += f"Translation: {trans}...\n\n"

    # 3. Translate current paragraphs
    glossary_text = json.dumps(glossary, ensure_ascii=False, indent=2) if glossary else "None"

    translation_prompt = f"""Translate the following {len(paragraphs)} paragraphs to {target_lang}.

**Style Guide:**
- Style: {style_guide.get('style', 'maintain original')}
- Tone: {style_guide.get('tone', 'neutral')}
- Domain: {style_guide.get('domain', 'general')}

**Glossary (MUST use these exact translations):**
{glossary_text}

{context_summary}

**Text to Translate:**
{_format_numbered_paragraphs(paragraphs)}

**Requirements:**
1. Use glossary terms consistently
2. Maintain context continuity with previous paragraphs
3. Preserve formatting (Markdown, code blocks, URLs)
4. Keep the same tone and style

**Output:** Numbered list of translations only, no explanations.
"""

    translation_result = await mcp.request_sampling(
        messages=[{"role": "user", "content": translation_prompt}],
        maxTokens=3000,
    )

    translations = _parse_numbered_translations(translation_result.content)

    # 4. Extract new terms (optional)
    new_terms = {}
    if extract_new_terms and len(glossary) < 200:
        existing_keys = ", ".join(glossary.keys()) if glossary else "Empty"
        term_prompt = f"""Extract 5-10 key terms from this translation for glossary.

**Original:**
{' '.join(paragraphs[:3])}

**Translation:**
{' '.join(translations[:3])}

**Existing Glossary (don't repeat):**
{existing_keys}

Return ONLY JSON:
{{"term1": "translation1", "term2": "translation2"}}
"""

        term_result = await mcp.request_sampling(
            messages=[{"role": "user", "content": term_prompt}],
            maxTokens=500,
        )

        new_terms = _parse_json_safe(term_result.content)
        glossary.update(new_terms)

    # 5. Build new context (for next call)
    new_previous = [
        {"original": orig, "translation": trans}
        for orig, trans in zip(paragraphs, translations, strict=False)
    ]

    new_context = {
        "glossary": glossary,
        "previous_paragraphs": new_previous[-2:],  # Keep only last 2 paragraphs
        "style_guide": style_guide,
    }

    return json.dumps(
        {
            "translations": translations,
            "context": new_context,
            "stats": {
                "translated": len(translations),
                "new_terms": len(new_terms),
                "glossary_size": len(glossary),
            },
        },
        ensure_ascii=False,
        indent=2,
    )


async def _analyze_style(paragraphs: list[str], target_lang: str) -> dict:
    """Analyze text style"""
    sample_text = "\n\n".join(paragraphs)

    prompt = f"""Analyze the style of this text:

{sample_text}

Extract:
1. Writing style (technical/academic/casual/narrative)
2. Tone (formal/informal/neutral)
3. Domain/field
4. Initial glossary: Extract 10-15 key terms that should be consistently translated to {target_lang}

Return JSON:
{{
    "style": "...",
    "tone": "...",
    "domain": "...",
    "initial_glossary": {{"term": "translation", ...}}
}}
"""

    result = await mcp.request_sampling(
        messages=[{"role": "user", "content": prompt}],
        maxTokens=1000,
    )

    return _parse_json_safe(result.content)


@mcp.tool()
def load_glossary(path: str) -> str:
    """
    Load glossary JSON file

    Args:
        path: JSON file path

    Returns:
        JSON: {"term": "translation", ...}
    """
    path_obj = Path(path)
    if not path_obj.exists():
        raise FileNotFoundError(f"Glossary file not found: {path}")

    glossary = json.loads(path_obj.read_text(encoding="utf-8"))
    return json.dumps(glossary, ensure_ascii=False)


@mcp.tool()
def save_glossary(glossary: dict[str, str], path: str) -> str:
    """
    Save glossary to JSON file

    Args:
        glossary: Glossary dictionary
        path: Output file path

    Returns:
        JSON: {"saved_to": "path"}
    """
    path_obj = Path(path)
    path_obj.parent.mkdir(parents=True, exist_ok=True)

    content = json.dumps(glossary, ensure_ascii=False, indent=2)
    path_obj.write_text(content, encoding="utf-8")

    return json.dumps({"saved_to": str(path)})


@mcp.tool()
def list_supported_languages() -> str:
    """
    List supported language codes

    Returns:
        JSON: {"zh-CN": "简体中文", "en": "English", ...}
    """
    return json.dumps(SUPPORTED_LANGUAGES, ensure_ascii=False, indent=2)


@mcp.prompt()
def translate_file(
    input_path: str,
    target_lang: str = "zh-CN",
    output_format: str = "interleaved",
    chunk_size: int = 10,
) -> dict:
    """
    Translate text file and save as new file

    Args:
        input_path: Input file path
        target_lang: Target language (zh-CN, en, ja, ko, fr, de, es, ru, pt, it)
        output_format: Output format
            - "interleaved": Original-translation interleaved (orig trans orig trans...)
            - "translation_only": Save only translation
        chunk_size: Number of paragraphs per batch (default 10)
    """
    output_path = _generate_output_path(input_path, target_lang, output_format)
    glossary_path = output_path.rsplit(".", 1)[0] + ".glossary.json"

    return {
        "messages": [
            {
                "role": "user",
                "content": f"""Translate the following file:

**Input file:** {input_path}
**Target language:** {target_lang}
**Output format:** {output_format}

Please follow these steps:

## Step 1: Split the document
Use the `split_document` tool to read and split the document:
```
split_document(path="{input_path}")
```
Save the returned `paragraphs` and `total`.

## Step 2: Translate in batches (preserving context)
Use the `translate_paragraphs` tool, translating {chunk_size} paragraphs at a time:

1. First batch (context=None):
   ```
   translate_paragraphs(
       paragraphs=[first {chunk_size} paragraphs],
       target_lang="{target_lang}",
       context=None
   )
   ```

2. Subsequent batches (pass previous context):
   ```
   translate_paragraphs(
       paragraphs=[next {chunk_size} paragraphs],
       target_lang="{target_lang}",
       context=<context from previous call>
   )
   ```

3. Repeat until all paragraphs are translated

**Notes:**
- Show progress after each batch: `Translated X/{'{total}'} paragraphs (glossary: Y terms)`
- Save each returned `translations` to a list
- Pass each `context` to the next batch

## Step 3: Save the file
Save according to `output_format`:

### If "interleaved" format:
```python
# Combine original and translation
lines = []
for orig, trans in zip(original_paragraphs, all_translations):
    lines.append(orig)      # Original
    lines.append("")        # Empty line
    lines.append(trans)     # Translation
    lines.append("")        # Empty line

content = "\\n".join(lines)
```

### If "translation_only" format:
```python
content = "\\n\\n".join(all_translations)
```

Use Write tool to save:
```
Write(file_path="{output_path}", content=content)
```

## Step 4: Save the glossary
Save the final glossary as JSON:
```
Write(
    file_path="{glossary_path}",
    content=json.dumps(final_context["glossary"], ensure_ascii=False, indent=2)
)
```

## Complete
Report translation results:
- Output file: {output_path}
- Glossary: {glossary_path}
- Total paragraphs: X
- Glossary size: Y
""",
            }
        ]
    }


def _generate_output_path(input_path: str, target_lang: str, output_format: str) -> str:
    """Generate output file path"""
    path_obj = Path(input_path)
    stem = path_obj.stem
    suffix = path_obj.suffix

    if output_format == "interleaved":
        new_name = f"{stem}.{target_lang}.bilingual{suffix}"
    else:  # translation_only
        new_name = f"{stem}.{target_lang}{suffix}"

    return str(path_obj.parent / new_name)


def main():
    """Entry point for the MCP server"""
    mcp.run()


if __name__ == "__main__":
    main()
