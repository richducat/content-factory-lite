/**
 * brand.config.js — the single source of truth for your brand.
 *
 * Content Factory Lite reads this file and turns it into platform-tailored
 * post drafts. Edit every field below to match YOUR brand — the values
 * shipped here describe a fictional example brand (a neighborhood coffee
 * shop) so you can run the tool immediately and see real output.
 *
 * Tips:
 * - Be concrete in `voice` and `neverSay`. The model follows specifics far
 *   better than adjectives ("we say 'roasted this morning', never 'artisanal'"
 *   beats "authentic and warm").
 * - `pillars` are your recurring content themes. 3-5 is plenty.
 * - `topics` are individual post ideas. The generator rotates through them
 *   by date, so a longer list = more variety before repeats.
 */

export const BRAND = {
  // ---------------------------------------------------------------------
  // Identity
  // ---------------------------------------------------------------------
  name: 'Driftwood Coffee Co.',
  shortName: 'Driftwood',
  tagline: 'Small-batch coffee, roasted two blocks from where you drink it.',

  // One or two sentences the model uses as ground truth about the business.
  // Only put FACTS here — the model will repeat them as true.
  about:
    'Driftwood Coffee Co. is a neighborhood coffee shop and micro-roastery. ' +
    'We roast small batches twice a week, name every roast after a local ' +
    'landmark, and donate day-old pastries to the community fridge.',

  // Where a post should send people. Used in CTAs.
  linkUrl: 'https://example.com/driftwood',
  defaultCta: 'Come taste this week’s roast',

  // ---------------------------------------------------------------------
  // Voice
  // ---------------------------------------------------------------------
  voice: {
    personality:
      'Warm, plainspoken, a little nerdy about roasting. Sounds like the ' +
      'owner talking, not a marketing department.',
    style: [
      'Short sentences. Concrete details over adjectives.',
      'First person plural ("we roasted", "our cortado").',
      'One idea per post — no kitchen-sink captions.',
      'Light humor is fine; puns about coffee are encouraged in moderation.',
    ],
    // Words and moves the model must avoid. Be ruthless here — this list
    // does more for on-brand output than anything else in the file.
    neverSay: [
      'artisanal',
      'elevate',
      'curated',
      'game-changer',
      'synergy',
      'clickbait-style ALL CAPS hooks',
      'emoji walls (more than 3 emoji per post)',
    ],
  },

  // ---------------------------------------------------------------------
  // Content pillars — recurring themes. Each post draft is tagged with one.
  // ---------------------------------------------------------------------
  pillars: [
    {
      id: 'behind-the-roast',
      name: 'Behind the Roast',
      description:
        'Process content: green beans arriving, roast curves, cupping notes, ' +
        'why this batch tastes the way it does.',
    },
    {
      id: 'neighborhood',
      name: 'Neighborhood Love',
      description:
        'The shop as a third place: regulars, the community fridge, local ' +
        'collabs, the dog wall of fame.',
    },
    {
      id: 'brew-better',
      name: 'Brew Better at Home',
      description:
        'Practical tips: grind size, water temperature, ratios, cheap gear ' +
        'that punches above its price.',
    },
    {
      id: 'menu-drops',
      name: 'Menu Drops',
      description:
        'New roasts, seasonal drinks, and pastry-case announcements with a ' +
        'clear reason to come in this week.',
    },
  ],

  // ---------------------------------------------------------------------
  // Topic queue — individual post ideas. The generator picks one per run
  // (rotating by date) unless you pass --topic on the command line.
  // Each topic maps to a pillar id from above.
  // ---------------------------------------------------------------------
  topics: [
    { pillar: 'behind-the-roast', idea: 'Why our Tuesday roast day smells like the whole block is baking bread' },
    { pillar: 'brew-better', idea: 'The one grind-size mistake that makes home pour-overs taste bitter' },
    { pillar: 'neighborhood', idea: 'Meet the 7am regulars who have ordered the same drink for three years' },
    { pillar: 'menu-drops', idea: 'This week’s roast: what it is, what it tastes like, when it runs out' },
    { pillar: 'brew-better', idea: 'You do not need a $200 kettle: our budget home-brew setup' },
    { pillar: 'behind-the-roast', idea: 'What a "roast curve" is and why we obsess over 30-second windows' },
    { pillar: 'neighborhood', idea: 'Where the day-old pastries actually go (the community fridge story)' },
    { pillar: 'menu-drops', idea: 'The seasonal drink we argued about for two weeks before putting on the menu' },
  ],

  // ---------------------------------------------------------------------
  // Platform rules — per-platform constraints applied to every draft.
  // Remove a platform here (or pass --platforms) to skip it.
  // ---------------------------------------------------------------------
  platforms: {
    instagram: {
      maxCaptionChars: 2200,
      targetCaptionChars: 500, // sweet spot; hard max is above
      hashtags: { min: 3, max: 8, note: 'niche + local tags, no giant generic tags' },
      imagePreset: 'portrait', // see SIZE_PRESETS in generate.mjs
      notes: 'Lead with a strong first line — it is the only line shown before "more".',
    },
    tiktok: {
      maxCaptionChars: 300,
      targetCaptionChars: 150,
      hashtags: { min: 2, max: 5, note: 'searchable topic tags, not #fyp spam' },
      imagePreset: 'story',
      notes:
        'Caption supports a VIDEO. Include a short shot-by-shot script (5-8 beats) ' +
        'and on-screen text overlays.',
    },
    linkedin: {
      maxCaptionChars: 3000,
      targetCaptionChars: 900,
      hashtags: { min: 0, max: 3, note: 'optional; only if genuinely relevant' },
      imagePreset: 'landscape',
      notes:
        'Angle for LinkedIn: the small-business / craft / operations story behind ' +
        'the post, not the consumer pitch. No hard sell.',
    },
  },
}
