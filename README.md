# AI PR Summarizer

Lightweight GitHub Action I built to keep track of what I've done in small projects or libraries. Instead of setting up heavy integrations with tools like Graphite or Coderabbit, this action generates a concise summary of pull request changes. It’s lightweight, easy to set up, and serves as a quick way to review the essence of changes made in a PR. You’re welcome to use it too!

## Setup

1. Add this to `.github/workflows/summarize.yml`:

```yaml
name: PR Summary
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  summarize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: ashgw/pr-summarizer@main
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          # Optional configurations:
          OPENAI_API_MODEL: "gpt-4o" # Default GPT-4 model to use
          exclude: "*.min.js,*.map" # Files to exclude from analysis
          max_files: "50" # Maximum number of files to analyze
```

## Configuration Options

| Option             | Description                        | Default                         |
| ------------------ | ---------------------------------- | ------------------------------- |
| `GITHUB_TOKEN`     | GitHub token for API access        | Required                        |
| `OPENAI_API_KEY`   | Your OpenAI API key                | Required                        |
| `OPENAI_API_MODEL` | GPT model to use                   | `gpt-4o`                        |
| `exclude`          | Glob patterns for files to exclude | `*.lock,dist/**,*.min.js,*.map` |
| `max_files`        | Maximum number of files to analyze | `50`                            |
