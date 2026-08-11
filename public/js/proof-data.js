/* ═══════════════════════════════════════════════════════════════════════════
   Real Work / Proof — source of truth.
   ONLY add items here when you have the actual screenshot files. Nothing in
   this list may be invented. Each item renders as a card in the proof
   gallery with a lightbox.

   How to add a real screenshot:
   1. Save the (redacted if needed) image into  public/assets/proof/
      Allowed formats: .jpg .jpeg .png .webp
   2. Add one entry below, e.g.:

      {
        id: 'conv-001',
        category: 'conversations',        // 'conversations' | 'delivery' | 'progress'
        image: '/assets/proof/conv-001.jpg',
        title: 'Client conversation — strategy questions',
        caption: 'Real chat with a client discussing their growth plan.',
        platform: 'Twitch',               // optional, e.g. 'YouTube', 'TikTok', 'Discord'
        date: '2026-07',                  // optional, only if you provide it
      },

   3. Refresh the /proof page.
   ═══════════════════════════════════════════════════════════════════════════ */

export const PROOF_ITEMS = [];

export const PROOF_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'conversations', label: 'Client Conversations', short: 'Conversations' },
  { id: 'delivery', label: 'Strategy Delivery', short: 'Delivery' },
  { id: 'progress', label: 'Channel Progress', short: 'Progress' },
];

export const PROOF_NOTE =
  'These are real examples of work and client communication. Client details are redacted for privacy. ' +
  'Every creator is different — these screenshots show real work, not a promise that every customer will get the same outcome.';
