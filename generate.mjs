#!/usr/bin/env node
/**
 * generate.mjs — one content cycle for one brand.
 *
 * Reads brand.config.js, picks a topic (rotating by date, or --topic),
 * asks OpenAI for platform-tailored post drafts, then writes:
 *
 *   output/YYYY-MM-DD-<topic-slug>.json   structured drafts + image briefs
 *   output/YYYY-MM-DD-<topic-slug>.md     human-readable review sheet
 *
 * This script generates DRAFTS. It never publishes, schedules, or uploads
 * anything anywhere. A human reviews the markdown, creates the image from
 * the brief, and posts it.
 *
 * Usage:
 *   node generate.mjs                          # today's topic, all platforms
 *   node generate.mjs --topic "..."            # explicit topic
 *   node generate.mjs --platforms instagram    # subset of platforms
 *   node generate.mjs --dry-run                # print the prompt, no API call
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { BRAND } from './brand.config.js'
import { chatJson, requireApiKey, FriendlyError } from './lib/openai.mjs'
import { buildSystemPrompt, buildUserPrompt, SIZE_PRESETS } from './lib/prompt.mjs'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_MODEL = 'gpt-4o-mini'

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  console.log(`Usage: node generate.mjs [options]

Options:
  --topic "..."         Override the rotating topic queue for this run
  --pillar <id>         Force a pillar id from brand.config.js
  --platforms a,b,c     Comma list (default: every platform in brand.config.js)
  --model <name>        Override OPENAI_MODEL / default (${DEFAULT_MODEL})
  --output-dir <path>   Where to write drafts (default: ./output)
  --dry-run             Print the prompts and exit — no API key needed
  --help                Show this help

Environment (see .env.example):
  OPENAI_API_KEY        Required unless --dry-run
  OPENAI_MODEL          Optional model override`)
}

function parseArgs(argv) {
  const options = { dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--topic':
        options.topic = next
        i += 1
        break
      case '--pillar':
        options.pillar = next
        i += 1
        break
      case '--platforms':
        options.platforms = String(next || '')
          .split(',')
          .map((p) => p.trim().toLowerCase())
          .filter(Boolean)
        i += 1
        break
      case '--model':
        options.model = next
        i += 1
        break
      case '--output-dir':
        options.outputDir = next
        i += 1
        break
      default:
        throw new FriendlyError(`Unknown option: ${arg} (try --help)`)
    }
  }
  return options
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Load KEY=value pairs from a local .env file (never committed) if present. */
async function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return
  const text = await readFile(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line)
    if (!match || line.trim().startsWith('#')) continue
    const value = match[2].replace(/^["'](.*)["']$/, '$1')
    if (process.env[match[1]] === undefined) {
      process.env[match[1]] = value
    }
  }
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function localDateString(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Pick today's topic by rotating through the queue with a stable index
 * derived from the date — so a daily cron naturally cycles the list.
 */
function pickTopic(brand, options) {
  if (options.topic) {
    const pillarId = options.pillar || brand.pillars[0].id
    const pillar = brand.pillars.find((p) => p.id === pillarId)
    if (!pillar) {
      throw new FriendlyError(
        `Unknown pillar "${pillarId}". Available: ${brand.pillars.map((p) => p.id).join(', ')}`,
      )
    }
    return { idea: options.topic, pillar }
  }

  const pool = options.pillar
    ? brand.topics.filter((t) => t.pillar === options.pillar)
    : brand.topics
  if (pool.length === 0) {
    throw new FriendlyError(`No topics found for pillar "${options.pillar}".`)
  }

  const daysSinceEpoch = Math.floor(Date.now() / 86_400_000)
  const entry = pool[daysSinceEpoch % pool.length]
  const pillar = brand.pillars.find((p) => p.id === entry.pillar)
  if (!pillar) {
    throw new FriendlyError(
      `Topic "${entry.idea}" references unknown pillar "${entry.pillar}". Fix brand.config.js.`,
    )
  }
  return { idea: entry.idea, pillar }
}

function resolvePlatforms(brand, options) {
  const configured = Object.keys(brand.platforms)
  const requested = options.platforms || configured
  const unknown = requested.filter((p) => !configured.includes(p))
  if (unknown.length > 0) {
    throw new FriendlyError(
      `Unknown platform(s): ${unknown.join(', ')}. Configured in brand.config.js: ${configured.join(', ')}`,
    )
  }
  return requested
}

// ---------------------------------------------------------------------------
// Response validation — trust but verify what the model returned
// ---------------------------------------------------------------------------

function normalizePosts(raw, brand, platforms, warnings) {
  const posts = Array.isArray(raw?.posts) ? raw.posts : []
  const byPlatform = new Map()
  for (const post of posts) {
    const platform = String(post?.platform || '').toLowerCase()
    if (platforms.includes(platform) && !byPlatform.has(platform)) {
      byPlatform.set(platform, post)
    }
  }

  const normalized = []
  for (const platform of platforms) {
    const post = byPlatform.get(platform)
    if (!post) {
      warnings.push(`Model returned no draft for ${platform}; skipped.`)
      continue
    }

    const rules = brand.platforms[platform]
    const preset = SIZE_PRESETS[rules.imagePreset]
    const caption = String(post.caption || '').trim()
    if (caption.length === 0) {
      warnings.push(`Empty caption for ${platform}; skipped.`)
      continue
    }
    if (caption.length > rules.maxCaptionChars) {
      warnings.push(
        `${platform} caption is ${caption.length} chars (max ${rules.maxCaptionChars}) — trim before posting.`,
      )
    }

    const hashtags = (Array.isArray(post.hashtags) ? post.hashtags : [])
      .map((tag) => String(tag).replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, rules.hashtags.max)

    normalized.push({
      platform,
      hook: String(post.hook || '').trim(),
      caption,
      hashtags,
      cta: String(post.cta || brand.defaultCta).trim(),
      script: (Array.isArray(post.script) ? post.script : []).map(String).filter(Boolean),
      onScreenText: (Array.isArray(post.onScreenText) ? post.onScreenText : [])
        .map(String)
        .filter(Boolean),
      imageBrief: {
        preset: rules.imagePreset,
        width: preset.width,
        height: preset.height,
        prompt: String(post.imageBrief?.prompt || '').trim(),
        altText: String(post.imageBrief?.altText || '').trim(),
      },
    })
  }

  if (normalized.length === 0) {
    throw new FriendlyError('Model response contained no usable drafts. Re-run the cycle.')
  }
  return normalized
}

// ---------------------------------------------------------------------------
// Output writers
// ---------------------------------------------------------------------------

function toMarkdown(result) {
  const lines = [
    `# ${result.brand} — content drafts for ${result.date}`,
    '',
    `- **Pillar:** ${result.pillar.name}`,
    `- **Topic:** ${result.topic}`,
    `- **Model:** ${result.model}`,
    '',
    '> Drafts only — review, create the image from each brief, then post manually.',
    '',
  ]

  for (const post of result.posts) {
    lines.push(`## ${post.platform}`, '')
    lines.push(`**Hook:** ${post.hook}`, '')
    lines.push('**Caption:**', '', '```', post.caption, '```', '')
    if (post.hashtags.length > 0) {
      lines.push(`**Hashtags:** ${post.hashtags.map((t) => `#${t}`).join(' ')}`, '')
    }
    lines.push(`**CTA:** ${post.cta}`, '')
    if (post.script.length > 0) {
      lines.push('**Video script:**', '')
      post.script.forEach((beat, i) => lines.push(`${i + 1}. ${beat}`))
      lines.push('')
    }
    if (post.onScreenText.length > 0) {
      lines.push('**On-screen text:**', '')
      post.onScreenText.forEach((t) => lines.push(`- ${t}`))
      lines.push('')
    }
    lines.push(
      `**Image brief** (${post.imageBrief.preset}, ${post.imageBrief.width}x${post.imageBrief.height}):`,
      '',
      post.imageBrief.prompt,
      '',
      `_Alt text:_ ${post.imageBrief.altText}`,
      '',
    )
  }

  if (result.warnings.length > 0) {
    lines.push('## Warnings', '')
    result.warnings.forEach((w) => lines.push(`- ${w}`))
    lines.push('')
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    usage()
    return
  }

  await loadDotEnv(path.join(ROOT, '.env'))

  const platforms = resolvePlatforms(BRAND, options)
  const { idea: topic, pillar } = pickTopic(BRAND, options)
  const model = options.model || process.env.OPENAI_MODEL || DEFAULT_MODEL

  const system = buildSystemPrompt(BRAND)
  const user = buildUserPrompt({ brand: BRAND, topic, pillar, platforms })

  if (options.dryRun) {
    console.log('--- DRY RUN (no API call) ---\n')
    console.log(`Model: ${model}`)
    console.log(`Platforms: ${platforms.join(', ')}`)
    console.log(`Pillar: ${pillar.name}`)
    console.log(`Topic: ${topic}\n`)
    console.log('--- system prompt ---\n')
    console.log(system)
    console.log('\n--- user prompt ---\n')
    console.log(user)
    return
  }

  const apiKey = requireApiKey()
  console.log(`Generating drafts for ${platforms.join(', ')} — topic: "${topic}"`)

  const raw = await chatJson({ apiKey, model, system, user })

  const warnings = []
  const posts = normalizePosts(raw, BRAND, platforms, warnings)

  const date = localDateString()
  const result = {
    brand: BRAND.name,
    generatedAt: new Date().toISOString(),
    date,
    model,
    pillar: { id: pillar.id, name: pillar.name },
    topic,
    platforms,
    warnings,
    posts,
  }

  const outputDir = path.resolve(ROOT, options.outputDir || 'output')
  await mkdir(outputDir, { recursive: true })
  const base = `${date}-${slugify(topic)}`
  const jsonPath = path.join(outputDir, `${base}.json`)
  const mdPath = path.join(outputDir, `${base}.md`)
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  await writeFile(mdPath, toMarkdown(result), 'utf8')

  console.log(`\nWrote ${posts.length} draft(s):`)
  console.log(`  ${jsonPath}`)
  console.log(`  ${mdPath}`)
  for (const warning of warnings) {
    console.warn(`  warning: ${warning}`)
  }
}

main().catch((error) => {
  if (error instanceof FriendlyError) {
    console.error(`\n${error.message}\n`)
  } else {
    console.error(error)
  }
  process.exitCode = 1
})
