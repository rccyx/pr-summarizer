
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
      - uses: ashgw/ag-summarizer@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          # Optional configurations:
          OPENAI_API_MODEL: "gpt-4-turbo-preview"  # Default GPT-4 model to use
          exclude: "*.lock,dist/**,*.min.js,*.map"  # Files to exclude from analysis
          max_files: "50"  # Maximum number of files to analyze
          comment_type: "review"  # Comment type (review/comment)
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `GITHUB_TOKEN` | GitHub token for API access | Required |
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `OPENAI_API_MODEL` | GPT model to use | `gpt-4-turbo-preview` |
| `exclude` | Glob patterns for files to exclude | `*.lock,dist/**,*.min.js,*.map` |
| `max_files` | Maximum number of files to analyze | `50` |
| `comment_type` | Type of PR comment to create (`review` or `comment`) | `review` |
