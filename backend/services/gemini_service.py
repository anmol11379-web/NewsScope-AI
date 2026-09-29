"""
NewsScope AI — Gemini 3.6 Flash News Verification Service
Connects to Google GenAI using the gemini-3.6-flash model to evaluate news claims,
detect media manipulation, check biases, and produce structured credibility reports.
"""

import json
import re
import logging
from typing import Dict, Any, List, Optional
from google import genai
from google.genai import types
from backend.config import GEMINI_API_KEY, MODEL_NAME
from backend.services.dataset_service import dataset_service

logger = logging.getLogger("newsscope.gemini")

SYSTEM_INSTRUCTION = """
You are NewsScope AI, an elite AI fact-checking and news verification engine powered by Google Gemini 3.6.
Your mission is to combat misinformation, evaluate news claims, assess media bias, detect deepfakes/manipulation, and deliver authoritative, objective credibility assessments.

When the user provides a statement, headline, article snippet, URL, or claim:
1. Determine if the user query is news-related or a fact-checkable claim:
   - If it is a greeting, general chit-chat, or question about your capabilities, set "is_news_query": false and answer helpfully in "conversational_reply". In this case, "analysis" can be null.
   - If it involves any news event, rumor, viral headline, scientific claim, political statement, or historical fact, set "is_news_query": true.

2. For news/claim verification ("is_news_query": true):
   - Rigorously assess factuality, source reliability, context, and potential manipulation.
   - Calculate a Credibility Score from 0 to 100:
     * 75 - 100: High credibility / Verified facts / Backed by reputable sources.
     * 45 - 74: Medium credibility / Partially accurate / Missing crucial context / Notable framing bias.
     * 0 - 44: Low credibility / Misleading / Fabricated / Debunked hoax / Deepfake.
   - Assign a Level: "high" | "medium" | "low"
   - Assign a Verdict: e.g. "Verified & Accurate", "Mostly Credible", "Partially Accurate", "Likely Misleading", "False & Fabricated", or "Highly Suspicious / Hoax".
   - Assign a Verdict Class for badges:
     * "badge-credible" (for verified/mostly credible, score >= 70)
     * "badge-suspicious" (for partially accurate or missing context, score 40-69)
     * "badge-fake" (for misleading, false, or fabricated, score < 40)
   - Identify Media Bias & Framing: e.g. "Neutral / Objective", "Sensationalist", "Left-leaning", "Right-leaning", "Fearmongering", "Clickbait".
   - Cite 2-4 authoritative Corroborating or Debunking Sources (e.g. Reuters, Associated Press, WHO, NASA, Nature, FactCheck.org, Snopes, BBC).
   - Write a concise 2-4 sentence executive summary detailing why the claim holds or fails.
   - Extract key factual sub-claims.

3. Always generate a concise, human-readable "chat_title" (2 to 5 words) that categorizes the chat type and identifies the specific topic or claim:
   - For headline verification: e.g., "Headline: [Subject]" (e.g., "Headline: Apple Foldable Rumor")
   - For source credibility check: e.g., "Source Check: [Outlet]" (e.g., "Source Check: BBC News")
   - For media bias & framing analysis: e.g., "Bias Check: [Topic]" (e.g., "Bias Check: Climate Policy")
   - For fact-checking claims: e.g., "Fact Check: [Subject]" (e.g., "Fact Check: Artemis II 2025")
   - For viral hoaxes & deepfakes: e.g., "Hoax Check: [Subject]" or "Deepfake: [Subject]"
   - For platform help / onboarding: e.g., "Getting Started" or "NewsScope Guide"
   NEVER output generic placeholders like "General Chat", "New Chat", "Chat", or empty string.

You MUST always output valid, parseable JSON matching this schema:
{
  "is_news_query": true,
  "chat_title": "Concise 2-5 Word Title",
  "conversational_reply": "I've cross-referenced this claim across primary sources and verification archives. Here is my credibility assessment:",
  "analysis": {
    "title": "Credibility & Fact-Check Report",
    "score": 88,
    "level": "high",
    "verdict": "Verified & Accurate",
    "verdictClass": "badge-credible",
    "bias": "Neutral / Balanced",
    "summary": "Detailed summary explaining the facts and corroborating context.",
    "sources": [
      "Reuters — Confirmed primary wire report",
      "Associated Press — Independent corroborating coverage"
    ],
    "key_claims": [
      "Specific verified statement 1"
    ]
  }
}
"""

class GeminiService:
    def __init__(self, api_key: str = GEMINI_API_KEY, model_name: str = MODEL_NAME):
        self.api_key = api_key
        self.model_name = model_name
        self._client = None
        self._init_client()

    def _init_client(self):
        try:
            self._client = genai.Client(api_key=self.api_key)
            logger.info(f"Gemini client initialized with model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize Google GenAI client: {e}")
            self._client = None

    def analyze_news(self, query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
        """Analyzes a news query or conversation using Gemini."""
        lower_q = (query or "").strip().lower()
        greetings = ["hi", "hello", "hey", "hola", "namaste", "good morning", "good evening", "good afternoon", "who are you", "what can you do", "help"]
        if any(lower_q == g or lower_q.startswith(g + " ") for g in greetings) and len(lower_q.split()) <= 5:
            return {
                "is_news_query": False,
                "chat_title": "Getting Started",
                "conversational_reply": "Hello! 👋 I'm NewsScope AI, your news verification assistant. Paste any news headline, article, or claim, and I'll analyze its credibility, check for media bias, and pull verified sources for you!",
                "analysis": None
            }

        if not self._client:
            self._init_client()
            if not self._client:
                return self._build_offline_fallback(query, "Google GenAI client could not be initialized.")

        # Check if query matches our curated benchmark dataset
        matched_item = dataset_service.find_similar_claim(query, threshold_score=2)
        dataset_context = ""
        if matched_item:
            dataset_context = f"""
[NewsScope Benchmark Dataset Ground-Truth Match Found]:
- Title: {matched_item.get('headline')}
- Claim: {matched_item.get('claim')}
- Ground Truth Verdict: {matched_item.get('verdict')}
- Benchmark Score: {matched_item.get('credibility_score')}
- Known Sources: {', '.join(matched_item.get('sources', []))}
- Analysis: {matched_item.get('detailed_analysis')}
Incorporate this verified benchmark background into your assessment.
"""

        # Prepare messages / prompt
        prompt_content = f"""
Analyze the following user query or claim for validity, factual accuracy, and bias:
"{query}"
{dataset_context}

Output ONLY valid JSON.
"""

        # Primary and backup models: prioritize stable models with zero 503 spikes
        models_to_try = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", self.model_name]
        # Remove duplicates while preserving order
        models_to_try = list(dict.fromkeys(models_to_try))
        last_error = None

        for m_name in models_to_try:
            try:
                chat = self._client.chats.create(
                    model=m_name,
                    config=types.GenerateContentConfig(
                        system_instruction=SYSTEM_INSTRUCTION,
                        temperature=0.2,
                        response_mime_type="application/json",
                        max_output_tokens=1500
                    )
                )
                response = chat.send_message(prompt_content)

                raw_text = response.text or ""
                parsed = self._clean_and_parse_json(raw_text)

                if matched_item and parsed.get("analysis"):
                    parsed["analysis"]["benchmark_matched"] = {
                        "id": matched_item.get("id"),
                        "category": matched_item.get("category"),
                        "fact_checker": matched_item.get("fact_checker")
                    }

                if not parsed.get("chat_title") or str(parsed.get("chat_title")).strip().lower() in ["general chat", "new chat", "chat", ""]:
                    parsed["chat_title"] = self._generate_fallback_title(query, matched_item)

                return parsed

            except Exception as e:
                last_error = e
                logger.warning(f"Model {m_name} encountered an issue: {e}. Trying fallback if available.")
                continue

        logger.error(f"All model attempts failed: {last_error}", exc_info=True)
        # If dataset has a similar match, return verified benchmark
        if matched_item:
            return self._build_dataset_fallback(query, matched_item)
        return self._build_offline_fallback(query, str(last_error))

    def _clean_and_parse_json(self, raw: str) -> Dict[str, Any]:
        """Strips markdown backticks and cleans json."""
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip().startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()

        try:
            return json.loads(cleaned)
        except Exception:
            # Fallback regex search for JSON block
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except Exception:
                    pass

            # Never leak raw truncated JSON syntax (e.g. {"is_news_query": true) to user
            if raw.strip().startswith("{") or "is_news_query" in raw:
                return {
                    "is_news_query": False,
                    "conversational_reply": "The AI verification response was incomplete or interrupted. Please try submitting your claim again.",
                    "analysis": None
                }

            # Construct a safe structure
            return {
                "is_news_query": False,
                "conversational_reply": raw,
                "analysis": None
            }

    def _generate_fallback_title(self, query: str, matched_item: Optional[Dict[str, Any]] = None) -> str:
        """Intelligently classifies the chat type and generates a 2-5 word title based on query intent."""
        if matched_item and matched_item.get("headline"):
            headline = matched_item["headline"]
            clean_head = re.sub(r'^[“"\'\s]+|[”"\'\s]+$', '', headline)
            words = clean_head.split()[:4]
            return f"Fact Check: {' '.join(words)}"

        q = (query or "").strip()
        lower_q = q.lower()

        # Greetings & General assistance
        greetings = ["hi", "hello", "hey", "hola", "namaste", "good morning", "good evening", "good afternoon"]
        if any(lower_q == g or lower_q.startswith(g + " ") for g in greetings) and len(lower_q.split()) <= 4:
            return "Getting Started"
        if any(phrase in lower_q for phrase in ["who are you", "what can you do", "help", "how do you work", "how does this work", "guide"]):
            return "NewsScope Guide"

        # Check for colon / spaced dash separator
        colon_match = re.search(r'^(?:verify|check|fact-?check|analyze|investigate)?\s*(?:this|the)?\s*(?:headline|claim|article|story|news|statement|source|outlet|credibility)?\s*(?:for me)?\s*(?::|\s+[-—]\s+)\s*(.+)$', q, re.I)
        payload = colon_match.group(1).strip() if colon_match else None

        # Source credibility check
        if any(phrase in lower_q for phrase in ["verify source", "verify the credibility of a news source", "credibility of", "is source", "check source", "source check", "verify a source"]):
            if payload and len(payload) > 1:
                return f"Source: {payload.split()[:3]}"
            m = re.search(r'(?:credibility of|source|outlet)\s+([A-Za-z0-9\s\.\-]{2,25})', q, re.I)
            if m:
                cand = re.sub(r'[?.:!]+$', '', m.group(1).strip())
                if cand.lower() not in ["a news source", "the source", "this", "news source", "a source"]:
                    return f"Source: {cand.title()}"
            return "Source Credibility Check"

        # Media bias & framing analysis
        if any(phrase in lower_q for phrase in ["bias and framing", "political bias", "analyze article bias", "media bias", "framing", "is it biased", "article bias"]):
            if payload and len(payload) > 2:
                words = payload.split()[:3]
                return f"Bias Check: {' '.join(words).title()}"
            return "Bias & Framing Analysis"

        # Headline verification
        if any(phrase in lower_q for phrase in ["verify this headline", "check a headline", "verify headline", "headline check", "is this headline"]):
            if payload and len(payload) > 2:
                words = payload.split()[:4]
                return f"Headline: {' '.join(words).title()}"
            return "Headline Verification"

        # Viral hoaxes & deepfakes
        if any(phrase in lower_q for phrase in ["deepfake", "manipulated video", "ai generated image", "fake image", "viral hoax", "hoax"]):
            if payload and len(payload) > 2:
                words = payload.split()[:3]
                return f"Hoax Check: {' '.join(words).title()}"
            return "Media & Deepfake Check"

        # Fact checking / claim checking
        if payload and len(payload) > 2:
            words = payload.split()[:4]
            return f"Fact Check: {' '.join(words).title()}"

        clean = re.sub(r'^(?:can you\s+)?(?:please\s+)?(?:fact-?check|verify|check)\s+(?:this\s+)?(?:claim|statement|news)?\s*(?:for me)?\s*[:—\-]?\s*', '', q, flags=re.I).strip()
        clean = re.sub(r'^(?:is it true that|did|does|is|are|can)\s+', '', clean, flags=re.I).strip()
        clean = re.sub(r'^[“"\'\s]+|[”"\'\s]+$', '', clean).strip()
        clean = re.sub(r'[?.:!]+$', '', clean).strip()

        words = clean.split()[:4]
        if words and len(' '.join(words)) > 2:
            return f"Fact Check: {' '.join(words).title()}"

        return "NewsScope Verification"

    def _build_dataset_fallback(self, query: str, item: Dict[str, Any]) -> Dict[str, Any]:
        """Provides verified ground truth response from local dataset if API call fails."""
        title = self._generate_fallback_title(query, item)
        return {
            "is_news_query": True,
            "chat_title": title,
            "conversational_reply": f"I verified this against the NewsScope benchmark database: {item.get('detailed_analysis')}",
            "analysis": {
                "title": "Benchmark Verified Analysis",
                "score": item.get("credibility_score", 50),
                "level": "high" if item.get("credibility_score", 50) >= 70 else ("medium" if item.get("credibility_score", 50) >= 40 else "low"),
                "verdict": item.get("verdict", "Unverified"),
                "verdictClass": item.get("verdict_class", "badge-suspicious"),
                "bias": item.get("bias_rating", "Neutral"),
                "sources": item.get("sources", ["NewsScope Verified Dataset Archive"]),
                "summary": item.get("detailed_analysis", ""),
                "key_claims": [item.get("claim", query)],
                "benchmark_matched": {
                    "id": item.get("id"),
                    "category": item.get("category"),
                    "fact_checker": item.get("fact_checker")
                }
            }
        }

    def _build_offline_fallback(self, query: str, err_msg: str) -> Dict[str, Any]:
        lower_q = (query or "").strip().lower()
        greetings = ["hi", "hello", "hey", "hola", "namaste", "good morning", "good evening", "good afternoon", "who are you", "what can you do", "help"]
        if any(lower_q == g or lower_q.startswith(g + " ") for g in greetings):
            return {
                "is_news_query": False,
                "chat_title": "Getting Started",
                "conversational_reply": "Hello! 👋 I'm NewsScope AI, your news verification assistant. Paste any news headline, article, or claim, and I'll analyze its credibility, check for media bias, and pull verified sources for you!",
                "analysis": None
            }

        lower_err = (err_msg or "").lower()
        if "401" in lower_err or "unauthenticated" in lower_err or "auth" in lower_err:
            friendly_message = "The Gemini API key is currently invalid or expired. Please update GEMINI_API_KEY with a valid key from Google AI Studio (starts with AIzaSy...)."
        elif "503" in lower_err or "demand" in lower_err or "unavailable" in lower_err or "429" in lower_err:
            friendly_message = "The AI verification servers are currently busy due to high traffic. Please try asking again in a few moments."
        elif "connection" in lower_err or "timeout" in lower_err or "network" in lower_err:
            friendly_message = "Unable to connect to the verification service right now. Please check your internet connection and try again."
        else:
            friendly_message = "The AI service is temporarily unavailable. Please try your request again in a moment."

        title = self._generate_fallback_title(query)
        return {
            "is_news_query": False,
            "chat_title": title,
            "conversational_reply": friendly_message,
            "analysis": None
        }

# Global singleton instance
gemini_service = GeminiService()
