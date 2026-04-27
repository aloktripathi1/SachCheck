from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from models.schemas import ScrapeResult


URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)

_SCRAPER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    )
}

_BOILERPLATE_TAGS = {"script", "style", "nav", "footer", "header", "aside", "form", "button", "noscript"}


def is_probable_url(value: str) -> bool:
    if not URL_PATTERN.match(value.strip()):
        return False
    parsed = urlparse(value.strip())
    return bool(parsed.scheme and parsed.netloc)


def _extract_article_body(soup: BeautifulSoup) -> str:
    for tag in soup(_BOILERPLATE_TAGS):
        tag.decompose()

    container = (
        soup.find("article")
        or soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.find(id=re.compile(r"(article|content|body|story)", re.I))
        or soup.find(class_=re.compile(r"(article|content|body|story)", re.I))
    )

    paragraphs = container.find_all("p") if container else soup.find_all("p")
    texts = [p.get_text(" ", strip=True) for p in paragraphs if len(p.get_text(strip=True)) > 40]
    return "\n\n".join(texts)


async def scrape_url(input_url: str) -> ScrapeResult:
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, headers=_SCRAPER_HEADERS) as client:
        response = await client.get(input_url)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    title = soup.title.string.strip() if soup.title and soup.title.string else None

    og_description = soup.find("meta", attrs={"property": "og:description"})
    description = None
    if og_description and og_description.get("content"):
        description = str(og_description.get("content")).strip()

    first_paragraph = None
    paragraph = soup.find("p")
    if paragraph:
        first_paragraph = paragraph.get_text(" ", strip=True)

    author_byline_present = bool(
        soup.find(attrs={"name": "author"})
        or soup.find(attrs={"property": "article:author"})
        or re.search(r"\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b", soup.get_text(" ", strip=True))
    )

    body_text = _extract_article_body(BeautifulSoup(response.text, "html.parser"))
    header_parts = [part for part in [title, description] if part]
    text_for_analysis = "\n\n".join(header_parts)
    if body_text:
        text_for_analysis = (text_for_analysis + "\n\n" + body_text).strip()

    if not text_for_analysis:
        text_for_analysis = soup.get_text(" ", strip=True)[:6000]
    else:
        text_for_analysis = text_for_analysis[:6000]

    return ScrapeResult(
        source_url=input_url,
        title=title,
        description=description,
        first_paragraph=first_paragraph,
        text_for_analysis=text_for_analysis,
        author_byline_present=author_byline_present,
    )
