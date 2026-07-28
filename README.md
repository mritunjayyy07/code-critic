# Code Critic

> AI-powered GitHub Pull Request Review Platform with Repository-Aware Code Intelligence

Code Critic is an AI-powered code review platform inspired by tools like CodeRabbit. It indexes an entire GitHub repository, understands the project context using Retrieval-Augmented Generation (RAG), and provides intelligent pull request reviews, security analysis, and repository-aware conversations.

---

## Features

### AI Pull Request Reviews
- Automatically reviews GitHub Pull Requests
- Provides line-by-line review comments
- Detects bugs, code smells, and maintainability issues
- Suggests improvements following best practices

### Repository Indexing
- Clones repositories securely
- Parses the complete codebase
- Generates embeddings for code chunks
- Stores embeddings in Qdrant Vector Database
- Retrieves relevant context during review

### Context-Aware AI
Unlike traditional LLM prompting, Code Critic understands the entire repository before reviewing code.

It can:
- Understand project architecture
- Follow existing coding patterns
- Detect inconsistencies
- Generate repository-specific feedback

### Security Analysis
- Detects common security vulnerabilities
- Identifies exposed secrets
- Finds insecure coding patterns
- Suggests secure alternatives

### Repository Chat
Ask questions like:

- "How does authentication work?"
- "Where is the payment logic?"
- "Explain the API flow."
- "Which files use Prisma?"
- "How is JWT implemented?"

The assistant answers using repository context.

### Custom Rules
Create organization-specific review rules such as:

- Use ShadCN UI only
- Avoid inline CSS
- Always validate inputs using Zod
- Use async/await instead of promises
- Never commit API keys

These rules are automatically considered during AI reviews.

### GitHub Integration
- GitHub OAuth
- Repository installation
- Pull Request webhooks
- Automatic review comments

---

## Architecture

```
                     GitHub
                        │
                        │
                Pull Request Event
                        │
                        ▼
              FastAPI Backend (Python)
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
 Repository        OpenAI API      Supabase
  Indexing         LLM Review      Database
        │
        ▼
Text Chunking
        │
        ▼
OpenAI Embeddings
        │
        ▼
Qdrant Vector Database
        │
        ▼
Relevant Context Retrieval
        │
        ▼
Repository-aware AI Review
        │
        ▼
GitHub Review Comments

```

---

## Tech Stack

### Frontend

- Next.js
- TypeScript
- Tailwind CSS
- ShadCN UI
- Clerk Authentication

### Backend

- FastAPI
- Python
- LangChain
- GitHub API

### Database

- Supabase
- PostgreSQL

### AI

- OpenAI GPT Models
- OpenAI Embeddings
- Retrieval Augmented Generation (RAG)

### Vector Database

- Qdrant

### Deployment

- Vercel (Frontend)
- Render (Backend)

---

## Project Structure

```
code-critic/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── hooks/
│   └── ...
│
├── backend/
│   ├── app/
│   ├── api/
│   ├── services/
│   ├── utils/
│   ├── models/
│   └── ...
│
└── README.md
```

---

## How It Works

### 1. Connect GitHub

- Login using GitHub
- Install Code Critic on your repositories

### 2. Repository Indexing

The backend:

- clones the repository
- splits code into chunks
- generates embeddings
- stores vectors in Qdrant

### 3. Pull Request Created

Whenever a PR is opened or updated:

- webhook is received
- changed files are extracted
- relevant repository context is retrieved

### 4. AI Review

The LLM analyzes:

- changed code
- repository context
- custom rules
- security concerns

and generates intelligent review comments.

---

## Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/code-critic.git
cd code-critic
```

---

### Backend

```bash
cd backend

python -m venv .venv

source .venv/bin/activate
# Windows
# .venv\Scripts\activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

---

### Frontend

```bash
cd frontend

npm install

npm run dev
```

---


---

## Future Enhancements

- AI-generated feature Pull Requests
- Multi-model support (OpenAI, Claude, Gemini)
- Repository health dashboard
- Review quality analytics
- CI/CD integration
- Team workspaces
- Incremental repository indexing
- Support for multiple vector databases

---

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a new feature branch

```bash
git checkout -b feature/my-feature
```

3. Commit changes

```bash
git commit -m "Add new feature"
```

4. Push

```bash
git push origin feature/my-feature
```

5. Open a Pull Request

---

## License

This project is licensed under the MIT License.

---

## Acknowledgements

Inspired by:

- CodeRabbit
- GitHub Copilot
- OpenAI
- LangChain
- Qdrant

---

## Author

**Mritunjay Kumar Rai**
