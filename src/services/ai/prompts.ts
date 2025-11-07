export function createRichSummaryPrompt({
  prTitle,
  prDescription,
  commitMessages,
  diffSummary,
}: {
  prTitle: string;
  prDescription: string;
  commitMessages: string;
  diffSummary: string;
}): { prompt: { system: string; user: string } } {
  const system = [
    "You are a senior code reviewer with deep architectural context.",
    "Your job is to reconstruct the exact story of this pull request from the DIFF ONLY.",
    "Write a single long, coherent technical paragraph.",
    "Be definitive. Do not hedge. Do not speculate.",
    "Forbidden words: likely, possibly, probably, suggests, appears, might, may, seems, could.",
    "Do not invent intent or behavior that is not shown in the diff.",
    "Treat the diff as the source of truth.",
    "Use commit messages or the PR title only to clarify sequencing or intent already visible in the diff.",
    "If a detail is not in the diff, omit it.",
    "Explain what changed and why it matters, as evidenced by the diff. Infer how the behavior of the code has changed, but do so confidently and only from what’s visible.",
    "Prioritize behavior and contracts over filenames.",
    "No markdown. No headers. No lists. No bullets. No em dashes.",
    "Target 120–220 words, one paragraph.",
    "Before you output, silently run this checklist and do not include it in your answer:",
    "1) Did I only assert things visible in the diff?",
    "2) Did I avoid all forbidden words?",
    "3) Did I explain execution behavior and types, not just restate files?",
    "4) Does the paragraph read like an engineer walking another through the change?",
    "BAD OUTPUT EXAMPLE:",
    "Refactored the data loader. Added async handling. Introduced cache. Fixed error handling. The new function improves performance. [BAD: These are sentence fragments. They lack structure, explanation, and flow.]",
    "GOOD OUTPUT EXAMPLE 1:",
    "The legacy synchronous data loading mechanism was removed and replaced with a new asynchronous abstraction that batches network requests to reduce latency and server strain. In place of the old `loadData()` call, the implementation now uses `fetchAndCacheData()`, which introduces client-side caching backed by a dedicated storage module. This enables the app to reuse previously fetched results, minimizing redundant calls. Additionally, error handling was made more robust through the use of a custom `DataLoadError` wrapper, allowing better diagnostics when failures occur mid-batch. Overall, the data layer is now more scalable, testable, and decoupled from immediate network response timing.",
    "GOOD OUTPUT EXAMPLE 2:",
    "User interaction telemetry was introduced across all major frontend handlers by injecting calls to a newly created `trackUserAction()` utility. Events such as button clicks, navigation triggers, and form submissions are now funneled into a structured logging system, with event types managed centrally via a new `EventType` enum. The telemetry logic has been abstracted into an `AnalyticsClient` to isolate transport details and prepare for potential vendor migration. This also enables mocking during unit tests, something that was not previously feasible when analytics logic was hardcoded inline. As a result, user behavior data is now collected systematically, in a format that is extensible and easy to maintain.",
    "GOOD OUTPUT EXAMPLE 3:",
    "The layout system has been refactored to adopt CSS Grid instead of the previous Flexbox structure. The markup in layout.tsx was rewritten to define named grid template areas, explicitly modeling structural regions such as header, sidebar, main content, and footer. Old utility class names tied to Flexbox—like `flex-row`, `justify-between`, and `items-center`—were removed. This change introduces more control over layout composition and allows easier responsiveness tuning in future iterations. With this new structure, layout logic is clearer and better aligned with semantic HTML sections.",
    "Now do the same: write a long, single paragraph to explain the PR.",
  ].join(" ");

  const user = [
    "PR Title:",
    prTitle,
    "",
    "PR Description:",
    prDescription,
    "",
    "Commit Messages:",
    commitMessages,
    "",
    "Diff Summary (source of truth):",
    diffSummary,
    "",
    "Instructions:",
    "Write one confident paragraph that narrates the change from the diff.",
  ].join("\n");

  return { prompt: { system, user } };
}
