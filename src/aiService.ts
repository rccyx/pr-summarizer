import OpenAI from "openai";
import * as core from "@actions/core";
import type { Optional } from "ts-roids";

export function createSummaryPrompt(
  filesChanged: string,
  prTitle: string,
  prDescription: string,
  commitMessages: string,
  diffSummary: string
): {
  prompt: {
    system: string;
    user: string;
  };
} {
  const system = `You are an expert GitHub code review assistant, integrated into an automated CI pipeline. 
You produce summaries of pull requests for technical stakeholders including engineers, tech leads, and SREs. 
Your output is read by humans to quickly understand what the PR is doing, why it was made, and what its implications are.
Your tone is neutral and professional. You never guess. If something is unclear, omit it.
The output is typically used in release notes, review tools, and changelogs.`;

  const user = `Your task is to write a clear, precise, and insightful summary of a pull request.

Your summary should:
- Identify the purpose of the PR (feature, fix, refactor, infra, etc.).
- Infer *why* the change was made using signals from the title, description, commit messages, and code diff.
- Describe *how* the change was implemented (at a system/module level, not per file).
- Call out any breaking changes, implications, or deployment considerations.
- Use professional, concise language and a neutral tone.

Avoid:
- Repeating the PR title verbatim.
- Listing file paths or file names unless they're semantically important.
- Using vague phrases like "code improvements" or "update stuff."
- Making subjective or promotional statements.

---

✔️ **GOOD EXAMPLES**

**Infra**  
Adds a preview deployment workflow for main branch pushes. It introduces jobs for base, website, and blog previews, includes concurrency guards, and posts deployment statuses to GitHub. This improves CI transparency and deployment confidence.

**Bugfix**  
Fixes a memory leak in the \`TaskManager\` caused by circular references. The solution uses \`WeakMap\` for cleanup tracking and ensures listeners are properly disposed. This improves stability in long-running services.

**Refactor**  
Modularizes the authentication flow by splitting \`UserAuth\` into \`TokenService\`, \`SessionManager\`, and \`UserVerifier\`. This improves code isolation, testability, and aligns with microservice principles.

**Feature**  
Implements user-configurable dashboards using a grid layout engine. State is persisted via \`localStorage\`. This enables drag-and-resize layout personalization without backend dependency.

---

❌ **BAD EXAMPLES**

**Infra**  
This PR adds a new file to the CI workflows folder to enable preview deployments. It affects ci.yml and adds a few jobs. These steps let you preview things before they hit prod.

**Bugfix**  
The title says it's fixing memory issues and it changes how some listeners work. It uses weak references which are better and makes the app cleaner.

**Refactor**  
The code was messy so this PR cleans it up. It renames some stuff and adds a few utility files to split up functions. This will help engineers understand the code better.

**Feature**  
New feature to let people customize their dashboard. It saves some stuff and uses grid. Adds a better experience for users.

---

Now, summarize this pull request. Let’s think step by step: first, identify the type of change (feature, fix, refactor, infra, etc.). Then explain what changed and why. Finally, call out anything important for reviewers, deployers, or downstream teams.

**PR Title:**  
${prTitle}

**PR Description:**  
${prDescription}

**Files Affected:**  
${filesChanged}

**Commit Messages:**  
${commitMessages}

**Code Diff Summary:**  
${diffSummary}

Start your summary below:`;

  return { prompt: { system, user } };
}

const OPENAI_API_KEY = core.getInput("OPENAI_API_KEY");
const OPENAI_API_MODEL = core.getInput("OPENAI_API_MODEL") ?? "gpt-4o";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

export async function getAISummary({
  commitMessages,
  diffSummary,
  filesChanged,
  prDescription,
  prTitle,
}: {
  filesChanged: string;
  prTitle: string;
  prDescription: string;
  commitMessages: string;
  diffSummary: string;
}): Promise<Optional<string>> {
  const { prompt } = createSummaryPrompt(
    filesChanged,
    prTitle,
    prDescription,
    commitMessages,
    diffSummary
  );

  try {
    const response = await openai.chat.completions.create({
      model: OPENAI_API_MODEL,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      seed: 69,
    });
    const content = response.choices[0].message?.content?.trim() ?? "";
    return content ?? null;
  } catch (error) {
    core.warning(
      `AI API Error: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

const goodExample = `
This pull request introduces new features related to tRPC in the blog application, focusing on enhancing blog post management capabilities. The changes span various areas of the codebase, including package.json, page components, API routes, context setup, models, services, and utilities. The PR adds functionalities for viewing lists of posts, inspecting individual post details, and creating new posts. It also improves data fetching, error handling, deprecation warnings, query client implementation, and integrates additional libraries like superjson and dinero.js.

The goal of these changes is to significantly expand the functionality of the blog application by introducing tRPC capabilities and enhancing blog post management features. This aims to improve the user experience, making the blog system more robust and efficient. The PR lays the groundwork for a more feature-rich and reliable blogging experience.

In summary, this PR adds tRPC integration, enhances data fetching, improves error handling, and updates dependencies in the blog application, setting the stage for a more advanced and reliable blogging platform. The changes affect a wide range of files across the codebase, from page components to server models and services, demonstrating a comprehensive update to the blog application's functionality and architecture.

This pull request introduces tRPC integration to the blog application, replacing the direct MdxService implementation with a more robust server-client architecture. The changes implement a complete tRPC setup with client, server, context, and provider components to handle blog post data fetching.

Key improvements include:

Added tRPC router, procedures, and API endpoint for blog post operations
Migrated from direct file system access to tRPC-based data fetching
Implemented proper data validation with Zod schemas for posts and metadata
Added server-side and client-side tRPC clients with proper typing
Created integration tests for the new tRPC endpoints
Enhanced error handling with better Sentry integration
Added CI workflow naming conventions documentation
The PR also includes dependency updates, adding support for libraries like superjson, dinero.js, and the TanStack Query (React Query) for state management. Error handling has been improved throughout the application with better Sentry integration and more consistent error reporting patterns.

The architecture changes provide a more maintainable and type-safe approach to data fetching in the blog application, with clear separation between server and client code while maintaining full type safety across the boundary.

Files Changed
.cursor/rules/ci.mdc
.github/workflows/README.md
apps/blog/instrumentation.ts
apps/blog/package.json
apps/blog/src/app/(pages)/[post]/page.tsx
apps/blog/src/app/(pages)/tag/[tag]/page.tsx
apps/blog/src/app/api/trpc/[trpc]/route.ts
apps/blog/src/app/components/pages/[post]/components/BlogPostData.tsx
apps/blog/src/app/components/pages/[post]/index.tsx
apps/blog/src/app/components/pages/[tag]/index.tsx
apps/blog/src/app/components/pages/home/components/BlogCards.tsx
apps/blog/src/app/components/pages/home/index.tsx
apps/blog/src/app/components/posts/components/Postcard.tsx
apps/blog/src/app/components/posts/index.tsx
apps/blog/src/app/layout.tsx
/dev/null
/dev/null
/dev/null
apps/blog/src/server/models/index.ts
apps/blog/src/server/models/post/dtos.ts
apps/blog/src/server/models/post/index.ts
apps/blog/src/server/models/post/ros.ts
apps/blog/src/server/router.ts
apps/blog/src/server/routes/post.ts
apps/blog/src/server/services/blog/index.ts
apps/blog/src/server/services/index.ts
apps/blog/src/trpc/client.ts
apps/blog/src/trpc/context.ts
apps/blog/src/trpc/provider.tsx
apps/blog/src/trpc/query-client.ts
apps/blog/src/trpc/server.ts
apps/blog/src/trpc/transformer.ts
apps/blog/src/trpc/trpc.ts
apps/blog/test/integration/blog.test.ts
apps/blog/vitest.config.ts
apps/www/instrumentation.ts
apps/www/src/app/components/pages/contact/index.tsx
packages/env/index.ts
packages/observabiliy/src/log.ts
packages/observabiliy/src/sentry/nextJs/captureException.ts
packages/observabiliy/src/sentry/nextJs/index.ts
pnpm-lock.yaml
pnpm-workspace.yaml
tooling/vitest/base.ts
`;

const badExample = `
This pull request introduces new features related to tRPC in the blog application, focusing on enhancing blog post management capabilities. The changes span various areas of the codebase, including package.json, page components, API routes, context setup, models, services, and utilities. The PR adds functionalities for viewing lists of posts, inspecting individual post details, and creating new posts. It also improves data fetching, error handling, deprecation warnings, query client implementation, and integrates additional libraries like superjson and dinero.js.

The goal of these changes is to significantly expand the functionality of the blog application by introducing tRPC capabilities and enhancing blog post management features. This aims to improve the user experience, making the blog system more robust and efficient. The PR lays the groundwork for a more feature-rich and reliable blogging experience.

In summary, this PR adds tRPC integration, enhances data fetching, improves error handling, and updates dependencies in the blog application, setting the stage for a more advanced and reliable blogging platform. The changes affect a wide range of files across the codebase, from page components to server models and services, demonstrating a comprehensive update to the blog application's functionality and architecture.

Files Changed
.cursor/rules/ci.mdc
.github/workflows/README.md
apps/blog/instrumentation.ts
apps/blog/package.json
apps/blog/src/app/(pages)/[post]/page.tsx
apps/blog/src/app/(pages)/tag/[tag]/page.tsx
apps/blog/src/app/api/trpc/[trpc]/route.ts
apps/blog/src/app/components/pages/[post]/components/BlogPostData.tsx
apps/blog/src/app/components/pages/[post]/index.tsx
apps/blog/src/app/components/pages/[tag]/index.tsx
apps/blog/src/app/components/pages/home/components/BlogCards.tsx
apps/blog/src/app/components/pages/home/index.tsx
apps/blog/src/app/components/posts/components/Postcard.tsx
apps/blog/src/app/components/posts/index.tsx
apps/blog/src/app/layout.tsx
/dev/null
/dev/null
/dev/null
apps/blog/src/server/models/index.ts
apps/blog/src/server/models/post/dtos.ts
apps/blog/src/server/models/post/index.ts
apps/blog/src/server/models/post/ros.ts
apps/blog/src/server/router.ts
apps/blog/src/server/routes/post.ts
apps/blog/src/server/services/blog/index.ts
apps/blog/src/server/services/index.ts
apps/blog/src/trpc/client.ts
apps/blog/src/trpc/context.ts
apps/blog/src/trpc/provider.tsx
apps/blog/src/trpc/query-client.ts
apps/blog/src/trpc/server.ts
apps/blog/src/trpc/transformer.ts
apps/blog/src/trpc/trpc.ts
apps/blog/test/integration/blog.test.ts
apps/blog/vitest.config.ts
apps/www/instrumentation.ts
apps/www/src/app/components/pages/contact/index.tsx
packages/env/index.ts
packages/observabiliy/src/log.ts
packages/observabiliy/src/sentry/nextJs/captureException.ts
packages/observabiliy/src/sentry/nextJs/index.ts
pnpm-lock.yaml
pnpm-workspace.yaml
tooling/vitest/base.ts
`;
