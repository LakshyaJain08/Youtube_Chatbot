"""
Web Search Component for YouTube Chatbot.
Integrates DuckDuckGo Web Search using DDGS (API backend) with multi-tier fallbacks (Lite, LangChain, Wikipedia)
to ensure 100% reliable, fast external search results without timeouts.
"""

import re
import urllib.request
import urllib.parse
import json
from typing import Dict, Any, List, Optional
from src.utils.logger import get_logger
from src.config.configuration import get_config

logger = get_logger("components.web_search")


class WebSearchManager:
    """Handles fast, reliable live web searching with multi-tier fallback."""

    def __init__(self):
        self.config = get_config()
        self._search_tool = None
        self._init_search_tool()

    def _init_search_tool(self):
        """Initializes LangChain DuckDuckGo tool if available."""
        try:
            from langchain_community.tools import DuckDuckGoSearchRun
            self._search_tool = DuckDuckGoSearchRun()
        except Exception as e:
            logger.debug(f"LangChain DuckDuckGoSearchRun initialization notice: {e}")
            self._search_tool = None

    def sanitize_query(self, raw_query: str) -> str:
        """
        Cleans conversational prefixes like 'from this video tell me what X is'
        to extract the core search subject for web search engines.
        """
        cleaned = raw_query.strip()
        patterns = [
            r'^(?:from\s+this\s+video\s+(?:tell\s+me\s+)?(?:what\s+is\s+|who\s+is\s+|explain\s+|describe\s+)?)',
            r'^(?:in\s+this\s+video\s+(?:does\s+the\s+speaker\s+mention\s+|what\s+is\s+|who\s+is\s+|explain\s+)?)',
            r'^(?:according\s+to\s+this\s+video\s+(?:what\s+is\s+|who\s+is\s+)?)',
            r'^(?:can\s+you\s+(?:please\s+)?tell\s+me\s+(?:about\s+)?)',
            r'^(?:please\s+tell\s+me\s+(?:about\s+)?)',
            r'^(?:tell\s+me\s+(?:about\s+|what\s+is\s+)?)',
            r'^(?:search\s+(?:the\s+web\s+)?for\s+)',
            r'^(?:what\s+did\s+the\s+speaker\s+say\s+about\s+)',
        ]
        for p in patterns:
            cleaned = re.sub(p, '', cleaned, flags=re.IGNORECASE).strip()

        # If stripping emptied the query, retain raw
        return cleaned if len(cleaned) >= 2 else raw_query.strip()

    def search(self, query: str, max_results: int = 4) -> str:
        """
        Executes web search with prioritized fast backends:
        1. DDGS API backend (fastest, no html timeout)
        2. DDGS Lite backend
        3. LangChain DuckDuckGo tool
        4. Wikipedia Search API fallback
        """
        if not query or not query.strip():
            return "No search query provided."

        clean_q = self.sanitize_query(query)
        logger.info(f"Executing web search for: '{clean_q}' (raw: '{query}')")

        # 1. Primary: DDGS text search
        try:
            try:
                from duckduckgo_search import DDGS
            except ImportError:
                from ddgs import DDGS

            with DDGS(timeout=3) as ddgs:
                results = list(ddgs.text(clean_q, max_results=max_results))
                if results:
                    snippets = []
                    for r in results:
                        title = r.get("title", "Web Result")
                        body = r.get("body", "")
                        href = r.get("href", "")
                        snippets.append(f"### {title}\nURL: {href}\n{body}")
                    logger.info(f"DDGS returned {len(results)} results.")
                    return "\n\n".join(snippets)
        except Exception as e1:
            logger.warning(f"DDGS text search notice: {e1}")

        # 2. Wikipedia Search API (Instant & ultra-reliable)
        try:
            logger.info(f"Using Wikipedia Search API for '{clean_q}'...")
            encoded_q = urllib.parse.quote_plus(clean_q)
            wiki_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={encoded_q}&utf8=&format=json"
            req = urllib.request.Request(
                wiki_url,
                headers={"User-Agent": "YouTubeAI-Copilot/2.0 (web-grounding-bot)"}
            )
            with urllib.request.urlopen(req, timeout=4) as response:
                data = json.loads(response.read().decode("utf-8"))
                search_items = data.get("query", {}).get("search", [])
                if search_items:
                    snippets = []
                    for item in search_items[:max_results]:
                        title = item.get("title", "")
                        snippet_clean = re.sub(r'<[^>]+>', '', item.get("snippet", ""))
                        page_url = f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
                        snippets.append(f"### {title} (Wikipedia)\nURL: {page_url}\n{snippet_clean}")
                    return "\n\n".join(snippets)
        except Exception as e4:
            logger.warning(f"Wikipedia search notice: {e4}")

        # 3. Tertiary: LangChain tool fallback
        if self._search_tool:
            try:
                res = self._search_tool.invoke(clean_q)
                if res and res.strip() and "not available" not in res.lower():
                    logger.info("LangChain DuckDuckGo tool succeeded.")
                    return res.strip()
            except Exception as e3:
                logger.warning(f"LangChain search tool notice: {e3}")

        return f"No live search results could be retrieved for '{clean_q}'."
