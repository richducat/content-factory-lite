/**
 * lib/prompt.mjs — turns the brand config + a chosen topic into the
 * system/user prompt pair sent to the model, and defines the JSON shape
 * the model must return.
 */

/** Image size presets referenced by brand.config.js `imagePreset` values. */
export const SIZE_PRESETS = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 627 },
}

/**
 * Build the system prompt: who the model is writing as, and the rules.
 */
export function buildSystemPrompt(brand) {
  const styleRules = brand.voice.style.map((rule) => `- ${rule}`).join('\n')
  const banned = brand.voice.neverSay.map((item) => `- ${item}`).join('\n')

  return [
    `You are the social media writer for ${brand.name} ("${brand.shortName}").`,
    '',
    `About the brand (treat as ground truth, do not invent other facts):`,
    brand.about,
    '',
    `Tagline: ${brand.tagline}`,
    '',
    `Personality: ${brand.voice.personality}`,
    '',
    'Style rules:',
    styleRules,
    '',
    'NEVER use any of the following words, phrases, or patterns:',
    banned,
    '',
    'You always respond with a single valid JSON object and nothing else.',
  ].join('\n')
}

/**
 * Build the user prompt for one generation run: the topic, the platforms,
 * per-platform constraints, and the exact JSON schema to return.
 */
export function buildUserPrompt({ brand, topic, pillar, platforms }) {
  const platformSpecs = platforms
    .map((name) => {
      const rules = brand.platforms[name]
      const preset = SIZE_PRESETS[rules.imagePreset]
      return [
        `### ${name}`,
        `- Target caption length: ~${rules.targetCaptionChars} chars (hard max ${rules.maxCaptionChars})`,
        `- Hashtags: ${rules.hashtags.min}-${rules.hashtags.max} (${rules.hashtags.note})`,
        `- Image: ${rules.imagePreset} ${preset.width}x${preset.height}`,
        `- Platform notes: ${rules.notes}`,
      ].join('\n')
    })
    .join('\n\n')

  const schemaLines = [
    '{',
    '  "posts": [',
    '    {',
    '      "platform": "<one of: ' + platforms.join(', ') + '>",',
    '      "hook": "<first line / opening beat, under 90 chars>",',
    '      "caption": "<full post caption, within that platform\'s limits>",',
    '      "hashtags": ["<tag without #>", "..."],',
    '      "cta": "<one-line call to action>",',
    '      "script": ["<shot-by-shot beat>", "..."],',
    '      "onScreenText": ["<short overlay line>", "..."],',
    '      "imageBrief": {',
    '        "prompt": "<one paragraph describing the image to create: subject, setting, mood, composition. Concrete and photographable — no text rendering requests.>",',
    '        "altText": "<accessibility alt text for the final image>"',
    '      }',
    '    }',
    '  ]',
    '}',
  ].join('\n')

  return [
    `Write one post draft for EACH of these platforms: ${platforms.join(', ')}.`,
    '',
    `Content pillar: ${pillar.name} — ${pillar.description}`,
    `Topic for this run: ${topic}`,
    `Call to action to work toward: ${brand.defaultCta} (${brand.linkUrl})`,
    '',
    'Platform requirements:',
    '',
    platformSpecs,
    '',
    'Rules:',
    '- "script" and "onScreenText" are REQUIRED for tiktok, and must be [] for other platforms.',
    '- Each platform gets a genuinely different angle on the topic — do not translate one caption three times.',
    '- Do not include hashtags inside "caption"; put them only in "hashtags".',
    '- Do not use markdown formatting inside any field.',
    '',
    'Return ONLY a JSON object with exactly this shape:',
    '',
    schemaLines,
  ].join('\n')
}
