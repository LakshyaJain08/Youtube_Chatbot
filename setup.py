from setuptools import setup, find_packages

setup(
    name="youtube_chatbot",
    version="2.0.0",
    description="Production-grade LLM YouTube Chatbot with Staged Hybrid RAG, Gemini 2.5 Flash, Citations and Evaluation",
    author="Antigravity Team",
    packages=find_packages(),
    python_requires=">=3.10",
    install_requires=[
        "fastapi>=0.104.0",
        "uvicorn>=0.24.0",
        "youtube-transcript-api>=1.2.0",
        "langchain>=0.3.0",
        "langchain-google-genai>=2.0.0",
        "faiss-cpu>=1.7.4",
        "rank-bm25>=0.2.2",
        "pydantic>=2.5.0",
        "pyyaml>=6.0.1",
        "python-dotenv>=1.0.0",
        "requests>=2.31.0",
    ],
)
