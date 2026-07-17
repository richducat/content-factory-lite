# Content Factory Lite

Turn one brand config file into platform-tailored social post drafts — Instagram, TikTok, and LinkedIn — with an image brief for every post. Zero dependencies, one script, human-in-the-loop by design.

This is the free, open-source starter version of the [Content Factory](https://eb28.co/content-factory/) engine. It generates **drafts** you review and post yourself; it never publishes, schedules, or connects to any social account.

Built by [Richard Ducat](https://eb28.co) · MIT licensed.

## 5-minute quickstart

Requires Node 18+ (built-in `fetch`). There is nothing to install.

```bash
git clone <this-repo> && cd content-factory-lite

# 1. Add your OpenAI key
cp .env.example .env
#    ...paste your key into .env (OPENAI_API_KEY=sk-...)

# 2. See what it will ask the model — no key needed for this
node generate.mjs --dry-run

# 3. Generate today's drafts
node generate.mjs
```

Output lands in `output/`:

```
output/2026-07-16-this-week-s-roast.json   # structured drafts + image briefs
output/2026-07-16-this-week-s-roast.md     # human-readable review sheet
```

Open the `.md`, tweak what you don't like, create the image from each brief, post.

The shipped config describes a fictional coffee shop ("Driftwood Coffee Co.") so it runs out of the box. Your first real step is editing `brand.config.js` to be about **your** brand.

### CLI options

```
node generate.mjs [options]

--topic "..."         Override the rotating topic queue for this run
--pillar <id>         Force a content pillar from brand.config.js
--platforms a,b,c     Subset (default: all configured platforms)
--model <name>        Override OPENAI_MODEL (default: gpt-4o-mini)
--output-dir <path>   Where drafts go (default: ./output)
--dry-run             Print the prompts and exit — no API call, no key needed
```

## Config reference (`brand.config.js`)

Everything lives in one exported `BRAND` object:

| Key | What it does |
|---|---|
| `name`, `shortName`, `tagline` | Brand identity used throughout the copy |
| `about` | Ground-truth facts the model may state. Facts only — it will repeat them as true |
| `linkUrl`, `defaultCta` | Where posts send people and the default call to action |
| `voice.personality` | One paragraph describing how the brand sounds |
| `voice.style` | Concrete writing rules (sentence length, POV, humor) |
| `voice.neverSay` | Banned words/patterns. The highest-leverage field in the file |
| `pillars` | 3–5 recurring content themes, each with `id`, `name`, `description` |
| `topics` | The post-idea queue. Each maps to a pillar. The generator rotates through it by date, so a daily run cycles the whole list |
| `platforms` | Per-platform rules: caption length targets/limits, hashtag counts, image size preset, and platform-specific notes |

Image size presets (`imagePreset`): `square` 1080×1080, `portrait` 1080×1350, `story` 1080×1920, `landscape` 1200×627.

## Architecture

```
brand.config.js          .env (OPENAI_API_KEY)
      |                        |
      v                        v
generate.mjs  --------> lib/prompt.mjs      builds system + user prompts
      |                                     from config + today's topic
      |
      +---------------> lib/openai.mjs      zero-dep fetch client,
      |                                     JSON mode, retry on 429/5xx
      v
normalize + validate    caption length checks, hashtag caps,
      |                 per-platform script/overlay rules
      v
output/DATE-slug.json   structured drafts (one per platform)
output/DATE-slug.md     review sheet for a human
```

Each post draft includes: `hook`, `caption`, `hashtags`, `cta`, a video `script` + `onScreenText` (TikTok), and an `imageBrief` — the size preset plus a one-paragraph prompt you can hand to any image tool (or a photographer), plus alt text.

## Running on a schedule (optional)

`.github/workflows/content-cycle.yml` is an optional GitHub Actions template:

- daily cron (13:00 UTC by default) plus manual `workflow_dispatch` with a topic override
- add `OPENAI_API_KEY` as a repository secret
- drafts are uploaded as a workflow artifact (14-day retention) for you to download and review

Nothing is committed to the repo and nothing is published anywhere.

## Lite vs. the full Content Factory

This starter is the honest core of the pipeline. The commercial [Content Factory](https://eb28.co/content-factory/) is the operated, end-to-end version:

| Capability | Lite (this repo) | Content Factory |
|---|---|---|
| Brands | One, via `brand.config.js` | Multi-brand orchestration |
| Copy drafts (IG / TikTok / LinkedIn) | Yes | Yes |
| Visual assets | Image **brief** (size + prompt text) | On-brand asset **rendering** (finished graphics) |
| Scheduling / publishing | None — you post manually | Buffer auto-scheduling |
| Review | You read the markdown | Structured approval workflow |
| Operations | You run the script | Daily operated cycles |

If you outgrow the Lite version, that's the upgrade path: [eb28.co/content-factory](https://eb28.co/content-factory/).

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 Richard Ducat.
