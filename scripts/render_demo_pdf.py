from __future__ import annotations

import base64
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
MD_PATH = ROOT / "docs" / "Project_Iris_Demo.md"
OUT_PDF = ROOT / "docs" / "Project_Iris_Demo.pdf"


def _escape_html(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _img_to_data_uri(path: Path) -> str:
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


def md_to_simple_html(md: str) -> str:
    """
    Minimal markdown-to-HTML renderer tailored to our demo doc:
    - headings (#, ##, ###)
    - unordered lists (- item)
    - paragraphs
    - images ![alt](path)

    This avoids pulling in a full markdown dependency and keeps output deterministic.
    """
    lines = md.splitlines()
    out: list[str] = []
    in_ul = False

    def close_ul():
        nonlocal in_ul
        if in_ul:
            out.append("</ul>")
            in_ul = False

    for raw in lines:
        line = raw.rstrip()
        if not line.strip():
            close_ul()
            continue

        if line.startswith("### "):
            close_ul()
            out.append(f"<h3>{_escape_html(line[4:])}</h3>")
            continue
        if line.startswith("## "):
            close_ul()
            out.append(f"<h2>{_escape_html(line[3:])}</h2>")
            continue
        if line.startswith("# "):
            close_ul()
            out.append(f"<h1>{_escape_html(line[2:])}</h1>")
            continue

        # image
        if line.lstrip().startswith("![") and "](" in line and line.endswith(")"):
            close_ul()
            try:
                alt = line.split("![", 1)[1].split("]", 1)[0]
                path_str = line.split("](", 1)[1][:-1]
                img_path = (MD_PATH.parent / path_str).resolve()
                if img_path.exists():
                    src = _img_to_data_uri(img_path)
                    out.append(f"<figure><img src=\"{src}\" alt=\"{_escape_html(alt)}\"/></figure>")
                else:
                    out.append(f"<p><em>Missing image: {_escape_html(path_str)}</em></p>")
            except Exception:
                out.append(f"<p>{_escape_html(line)}</p>")
            continue

        # list item
        if line.startswith("- "):
            if not in_ul:
                out.append("<ul>")
                in_ul = True
            out.append(f"<li>{_escape_html(line[2:])}</li>")
            continue

        close_ul()
        # bold markers **text** -> <strong>text</strong> (simple, non-nested)
        text = _escape_html(line)
        while "**" in text:
            pre, rest = text.split("**", 1)
            if "**" not in rest:
                break
            mid, post = rest.split("**", 1)
            text = pre + f"<strong>{mid}</strong>" + post
        out.append(f"<p>{text}</p>")

    close_ul()
    return "\n".join(out)


def build_html() -> str:
    md = MD_PATH.read_text(encoding="utf-8")
    body = md_to_simple_html(md)
    return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8"/>
    <title>Project Iris Demo</title>
    <style>
      @page {{
        size: Letter;
        margin: 0.75in;
      }}
      body {{
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        color: #111;
        line-height: 1.35;
        font-size: 11.5pt;
      }}
      h1 {{ font-size: 22pt; margin: 0 0 8px 0; }}
      h2 {{ font-size: 15pt; margin: 18px 0 8px 0; }}
      h3 {{ font-size: 12.5pt; margin: 14px 0 6px 0; }}
      p {{ margin: 6px 0; }}
      ul {{ margin: 6px 0 10px 20px; padding: 0; }}
      li {{ margin: 3px 0; }}
      figure {{ margin: 12px 0; }}
      img {{
        width: 100%;
        height: auto;
        border: 1px solid #ddd;
        border-radius: 6px;
        break-inside: avoid;
      }}
      em {{ color: #555; }}
      strong {{ font-weight: 700; }}
    </style>
  </head>
  <body>
    {body}
  </body>
</html>
"""


def main() -> None:
    html = build_html()
    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.set_content(html, wait_until="domcontentloaded")
        page.emulate_media(media="print")
        page.pdf(
            path=str(OUT_PDF),
            format="Letter",
            print_background=True,
            margin={"top": "0.75in", "right": "0.75in", "bottom": "0.75in", "left": "0.75in"},
        )
        browser.close()

    print(f"Wrote PDF: {OUT_PDF}")


if __name__ == "__main__":
    main()

