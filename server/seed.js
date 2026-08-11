/**
 * Product catalog — the complete official Agbota Segun strategy catalog.
 * Prices are fixed as published; do not change them without the owner's
 * explicit instruction.
 *
 * Seeding is idempotent: products already in the database are left untouched
 * (so catalog edits made from the Admin dashboard survive restarts).
 */
'use strict';

const products = [
  // ── Single platform strategies — $30 ─────────────────────────────────────
  {
    id: 'youtube', name: 'YouTube Strategy', price_cents: 3000, category: 'single',
    platforms: ['YouTube'], sort_order: 1,
    tagline: 'A structured plan for turning consistent uploads into real channel growth.',
    description:
      'A practical YouTube growth blueprint built around positioning, discoverability and consistency. ' +
      'Instead of guessing what works, you work from a clear content structure designed to help your channel become easier to find, easier to watch, and easier to grow.',
    includes: [
      'Channel positioning and niche clarity framework',
      'Content pillar and upload structure plan',
      'Title, thumbnail and packaging guidelines',
      'Search and discovery checklist',
      'Consistency and content pipeline system',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['New and small YouTube creators', 'Channels that feel stuck or inconsistent', 'Creators who want a clearer monthly content plan'],
  },
  {
    id: 'twitch', name: 'Twitch Strategy', price_cents: 3000, category: 'single',
    platforms: ['Twitch'], sort_order: 2,
    tagline: 'A streamer-focused blueprint for discoverability, structure and community growth.',
    description:
      'A Twitch growth strategy built for streamers: stream structure, discoverability, and community habits that make viewers want to come back. ' +
      'Designed to give your channel a more organized and effective growth approach.',
    includes: [
      'Stream schedule and structure framework',
      'Channel page and category positioning',
      'Discoverability and tags checklist',
      'Chat and community engagement habits',
      'Viewer retention and return-viewer plan',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['New and small Twitch streamers', 'Streamers with inconsistent schedules', 'Creators building a returning-viewer community'],
  },
  {
    id: 'tiktok', name: 'TikTok Strategy', price_cents: 3000, category: 'single',
    platforms: ['TikTok'], sort_order: 3,
    tagline: 'A short-form content system that helps your videos get seen by the right people.',
    description:
      'A TikTok strategy focused on positioning, consistency and discoverability. ' +
      'You get a practical structure for planning, creating and posting short-form content with a clearer sense of direction.',
    includes: [
      'Account positioning and niche framework',
      'Content pillar and posting cadence plan',
      'Hook, pacing and video structure guidelines',
      'Hashtag and discovery checklist',
      'Short-form content pipeline system',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['New and small TikTok creators', 'Creators posting without a clear direction', 'Anyone building a short-form content system'],
  },
  {
    id: 'facebook', name: 'Facebook Strategy', price_cents: 3000, category: 'single',
    platforms: ['Facebook'], sort_order: 4,
    tagline: 'A practical content and audience-growth strategy for Facebook creators.',
    description:
      'A Facebook creator strategy covering page positioning, content structure and audience development. ' +
      'Built to give your page a more organized approach to publishing and engaging your audience.',
    includes: [
      'Page positioning and profile framework',
      'Content pillar and posting plan',
      'Engagement and community habits checklist',
      'Reach and distribution guidelines',
      'Consistency and planning system',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Facebook creators and page owners', 'Small pages looking for structure', 'Creators building a community on Facebook'],
  },
  {
    id: 'instagram', name: 'Instagram Strategy', price_cents: 3000, category: 'single',
    platforms: ['Instagram'], sort_order: 5,
    tagline: 'A creator strategy for content positioning, discovery and audience development.',
    description:
      'An Instagram growth strategy covering profile positioning, content structure and discovery. ' +
      'A clear framework for presenting your work consistently and giving your audience a reason to follow and stay.',
    includes: [
      'Profile positioning and bio framework',
      'Content pillar and posting cadence plan',
      'Reels and post structure guidelines',
      'Discovery and hashtag checklist',
      'Audience engagement habits',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['New and small Instagram creators', 'Creators posting inconsistently', 'Anyone building a recognizable page'],
  },
  {
    id: 'discord', name: 'Discord Strategy', price_cents: 3000, category: 'single',
    platforms: ['Discord'], sort_order: 6,
    tagline: 'A community strategy for building and organizing a stronger creator community.',
    description:
      'A Discord strategy for creators who want a community that is organized, active and sustainable. ' +
      'Covers server structure, roles, onboarding and engagement habits that help a community grow with purpose.',
    includes: [
      'Server structure and channel framework',
      'Roles, permissions and onboarding plan',
      'Community rules and culture guidelines',
      'Engagement and activity habits',
      'Growth and invitation checklist',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Creators with a Discord community', 'Streamers who want a stronger community space', 'Community managers starting fresh'],
  },

  // ── Combined strategies ───────────────────────────────────────────────────
  {
    id: 'tiktok-instagram', name: 'TikTok + Instagram Strategy', price_cents: 5500, category: 'bundle',
    platforms: ['TikTok', 'Instagram'], sort_order: 7,
    tagline: 'One connected short-form system across TikTok and Instagram.',
    description:
      'A combined strategy for creators publishing on both TikTok and Instagram. ' +
      'One coordinated short-form content system across two platforms, so your effort compounds instead of splitting.',
    includes: [
      'Dual-platform positioning framework',
      'Unified content pillar and cadence plan',
      'Platform-specific format guidelines',
      'Cross-posting and adaptation checklist',
      'Discovery setup for both platforms',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Creators active on both platforms', 'Short-form creators scaling to two platforms', 'Creators posting the same content to both'],
  },
  {
    id: 'youtube-tiktok', name: 'YouTube + TikTok Strategy', price_cents: 6000, category: 'bundle',
    platforms: ['YouTube', 'TikTok'], sort_order: 8,
    tagline: 'Long-form depth meets short-form reach — one connected strategy.',
    description:
      'A cross-platform strategy connecting long-form YouTube content with short-form TikTok reach. ' +
      'A coordinated system where each platform feeds the other, giving your content more chances to be discovered.',
    includes: [
      'Cross-platform positioning framework',
      'Long-form and short-form content mapping',
      'Conversion funnel between platforms',
      'Upload pipeline and cadence plan',
      'Discovery checklist for both platforms',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['YouTubers expanding to TikTok', 'TikTok creators moving into long-form', 'Creators who want platforms to work together'],
  },
  {
    id: 'twitch-discord', name: 'Twitch + Discord Strategy', price_cents: 6000, category: 'bundle',
    platforms: ['Twitch', 'Discord'], sort_order: 9,
    tagline: 'Live content connected to a dedicated community that keeps growing between streams.',
    description:
      'A streamer and community strategy connecting your live content with a dedicated Discord community. ' +
      'Built to turn casual viewers into regulars who show up, engage and bring others with them.',
    includes: [
      'Stream and community positioning plan',
      'Viewer-to-Discord conversion system',
      'Server structure for streamer communities',
      'Between-stream engagement habits',
      'Retention and return-viewer checklist',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Twitch streamers with a Discord', 'Streamers wanting a stronger community', 'Streamers rebuilding their community structure'],
  },
  {
    id: 'youtube-instagram-tiktok', name: 'YouTube + Instagram + TikTok Strategy', price_cents: 8000, category: 'bundle',
    platforms: ['YouTube', 'Instagram', 'TikTok'], sort_order: 10,
    tagline: 'Three platforms, one coordinated content engine.',
    description:
      'A three-platform content and discovery strategy for creators active on YouTube, Instagram and TikTok. ' +
      'One coordinated engine that produces the right content in the right format for each platform.',
    includes: [
      'Three-platform positioning framework',
      'Master content pillar system',
      'Format adaptation for each platform',
      'Coordinated publishing calendar',
      'Discovery setup across all platforms',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Creators already active on all three', 'Creators overwhelmed by multiple platforms', 'Creators wanting one system instead of three'],
  },
  {
    id: 'twitch-tiktok-discord', name: 'Twitch + TikTok + Discord Strategy', price_cents: 8500, category: 'bundle',
    platforms: ['Twitch', 'TikTok', 'Discord'], sort_order: 11,
    tagline: 'Live, short-form and community — a complete streaming ecosystem.',
    description:
      'A live, short-form and community growth ecosystem strategy for streamers using Twitch, TikTok and Discord together. ' +
      'Each platform plays a role: discovery, live experience and community depth.',
    includes: [
      'Ecosystem positioning framework',
      'TikTok-to-Twitch discovery funnel',
      'Twitch-to-Discord community conversion',
      'Content mapping across all three',
      'Weekly ecosystem rhythm plan',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Streamers expanding beyond Twitch', 'Streamers building a full ecosystem', 'Creators connecting short-form to live content'],
  },
  {
    id: 'youtube-twitch-tiktok', name: 'YouTube + Twitch + TikTok Strategy', price_cents: 9500, category: 'bundle',
    platforms: ['YouTube', 'Twitch', 'TikTok'], sort_order: 12,
    tagline: 'Video, livestreaming and short-form working as one growth system.',
    description:
      'A cross-platform strategy connecting long-form video, live streaming and short-form content. ' +
      'Designed for creators who want their YouTube channel, Twitch streams and TikTok presence to reinforce each other.',
    includes: [
      'Three-platform positioning framework',
      'Content and stream mapping system',
      'Audience movement between platforms',
      'Coordinated scheduling plan',
      'Discovery checklist for all three',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Creators active in video, live and short-form', 'Streamers growing a YouTube presence', 'Creators building a multi-platform system'],
  },
  {
    id: 'youtube-twitch-tiktok-discord', name: 'YouTube + Twitch + TikTok + Discord Strategy', price_cents: 12000, category: 'bundle',
    platforms: ['YouTube', 'Twitch', 'TikTok', 'Discord'], sort_order: 13,
    tagline: 'The full creator ecosystem strategy — every platform with a purpose.',
    description:
      'The complete creator ecosystem strategy covering YouTube, Twitch, TikTok and Discord. ' +
      'Every platform gets a defined role in one connected growth system, with a clear plan for how they work together.',
    includes: [
      'Full ecosystem positioning framework',
      'Platform role and priority mapping',
      'End-to-end audience journey design',
      'Coordinated content and stream calendar',
      'Community and retention system',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Creators building a full multi-platform presence', 'Established small creators ready to systematize', 'Creators who want every platform pulling in one direction'],
  },

  // ── Custom ────────────────────────────────────────────────────────────────
  {
    id: 'custom-multi', name: 'Custom Multi-Platform Strategy', price_cents: 15000, category: 'custom',
    platforms: ['Your platforms'], sort_order: 14,
    tagline: 'A tailored strategy built around your exact platforms, goals and situation.',
    description:
      'A custom multi-platform strategy starting around $150, built personally for your situation. ' +
      'We start with a conversation about your platforms, your goals and where you are now — then build a structured growth approach designed around you. Final scope and price are agreed before you pay.',
    includes: [
      'One-on-one strategy conversation',
      'Personal platform and goal analysis',
      'Custom growth strategy document',
      'Personalized content and posting plan',
      'Follow-up support through chat',
      'Direct support through the Agbota Segun chat',
    ],
    audience: ['Creators with specific or unusual goals', 'Creators on multiple platforms', 'Creators who want a personally tailored plan'],
  },
];

async function seedProducts(q) {
  for (const p of products) {
    await q(
      `INSERT INTO products (id, name, price_cents, category, platforms, tagline, description, includes, audience, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id, p.name, p.price_cents, p.category,
        JSON.stringify(p.platforms), p.tagline, p.description,
        JSON.stringify(p.includes), JSON.stringify(p.audience), p.sort_order,
      ]
    );
  }
  return products;
}

module.exports = { products, seedProducts };
