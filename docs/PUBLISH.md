# Publishing semcache

Everything the repository needs on GitHub, written before it exists.

## The About box

**Description**, 350 characters or fewer, carrying the number:

> A semantic cache for LLM calls, measured on requests its thresholds were never chosen on. An entity
> guard lets it cut 79.5% of the bill instead of 51.8%, until the questions name a product or a
> country: then it serves 453 wrong answers in 1,000. Every wrong answer is shown word for word.

**Homepage**: `https://broikos-nikos.github.io/semcache/`

**Topics**, ten:

```
llm  semantic-cache  caching  llmops  embeddings  cost-optimization  llm-evaluation  customer-support  typescript  data-visualization
```

`semantic-cache` and `llmops` are the two that matter: somebody pricing a support bot is searching one
of them, and what nobody publishes is the wrong answers a cache serves to buy its savings.

## Settings

- **Public.** Issues on, wiki, projects and discussions off.
- **Pages from GitHub Actions**, not from a branch: the workflow deploys only when the build gates and
  the browser gates both pass.
- **No default community files.** The MIT LICENSE is committed, and `check:licence` holds the README to
  it.

## The order

1. Create the repository with the description, homepage and topics above.
2. Push `main` with its whole history, every commit authored `Nikos Broikos
   <broikos.nikolaos@gmail.com>`, none co-authored.
3. Turn Pages on with GitHub Actions as the source, and watch the first deploy to green.
4. Open the live page in a browser at 1280 and 390 and look at it.
5. Only then, a second push puts the live link at the top of the README.
