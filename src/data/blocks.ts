export type Block = {
  id: string;
  slot: number;
  kicker: string;
  title: string;
  icon: string;
  color: string;
  excerpt: string;
  html: string;
  hint: string;
  puzzle?: { type: 'code'; code: string; clue: string };
};

export const BLOCKS: Block[] = [
  {
    id: 'desk',
    slot: 0,
    kicker: 'BLOCK 01 — ABOUT',
    title: 'Who we are',
    icon: '◐',
    color: '#f59e0b',
    excerpt: 'Studio, not agency.',
    hint: 'The drawer under the desk is slightly open.',
    html: `
      <p class="text-white text-base leading-relaxed">We are <b>Blueblood Studio</b> — a solo, AI-augmented design studio that ships like a team of ten. No bloat, no handoffs. One partner, end-to-end ownership.</p>
      <div class="grid md:grid-cols-3 gap-3">
        <div class="glass rounded-xl p-4"><div class="text-amber-400 font-mono text-xs">01</div><div class="font-bold mt-1">Design-led</div><div class="text-white/60 text-xs mt-1">Figma is source of truth. Every pixel has a reason.</div></div>
        <div class="glass rounded-xl p-4"><div class="text-amber-400 font-mono text-xs">02</div><div class="font-bold mt-1">Performance first</div><div class="text-white/60 text-xs mt-1">90+ Lighthouse, sub-2s LCP. Non-negotiable.</div></div>
        <div class="glass rounded-xl p-4"><div class="text-amber-400 font-mono text-xs">03</div><div class="font-bold mt-1">AI leverage</div><div class="text-white/60 text-xs mt-1">60–80% faster via structured LLM workflows.</div></div>
      </div>
      <div class="rounded-xl border border-white/10 p-4 bg-white/[0.03]">
        <div class="text-xs font-mono tracking-[0.15em] text-white/40">MANIFESTO</div>
        <p class="mt-2 italic text-white/80">“Taste is the only moat that compounds. We build for founders who care about the last 5%.”</p>
      </div>
    `,
  },
  {
    id: 'bookshelf',
    slot: 1,
    kicker: 'BLOCK 02 — SERVICES',
    title: 'What we do',
    icon: '▦',
    color: '#10b981',
    excerpt: 'From idea to revenue.',
    hint: 'One book on the shelf is brighter than the rest.',
    html: `
      <div class="grid md:grid-cols-2 gap-3">
        <div class="rounded-xl bg-white text-black p-4"><div class="text-xs font-mono tracking-wide text-black/50">01 — WEB</div><div class="font-bold">Premium Websites</div><div class="text-sm text-black/60 mt-1">Next.js, Tailwind, Framer Motion. The sites that make you look 10x bigger.</div></div>
        <div class="rounded-xl bg-amber-500 text-black p-4"><div class="text-xs font-mono tracking-wide text-black/60">02 — COMMERCE</div><div class="font-bold">Headless Shopify</div><div class="text-sm text-black/70 mt-1">Storefront API + custom Next.js. Our specialty — 5 live builds.</div></div>
        <div class="rounded-xl border border-white/15 p-4"><div class="text-xs font-mono text-white/50">03 — SaaS</div><div class="font-bold text-white">Web Applications</div><div class="text-sm text-white/60 mt-1">EMS, HR/Payroll, real-time tools with Supabase + Vercel.</div></div>
        <div class="rounded-xl border border-white/15 p-4"><div class="text-xs font-mono text-white/50">04 — AI</div><div class="font-bold text-white">AI Agents & Automations</div><div class="text-sm text-white/60 mt-1">RAG, n8n, Claude API, voice agents. Automation that actually ships.</div></div>
      </div>
      <div class="flex gap-2 text-xs font-mono">
        <span class="px-3 py-1 rounded-full bg-white/10 border border-white/10">Next.js 14</span>
        <span class="px-3 py-1 rounded-full bg-white/10 border border-white/10">Three.js / R3F</span>
        <span class="px-3 py-1 rounded-full bg-white/10 border border-white/10">Sanity / Payload</span>
      </div>
    `,
  },
  {
    id: 'painting',
    slot: 2,
    kicker: 'BLOCK 03 — WORK',
    title: 'Selected work',
    icon: '⬢',
    color: '#8b5cf6',
    excerpt: '17 live products.',
    hint: 'The painting is crooked — something behind it?',
    html: `
      <div class="space-y-3">
        <div class="flex gap-3 items-center rounded-xl border border-white/10 p-3">
          <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600"></div>
          <div><div class="font-bold">Turq & Taupe</div><div class="text-xs text-white/60">Headless Shopify • 94 Lighthouse • +38% conversion</div></div>
          <span class="ml-auto text-xs font-mono px-2 py-1 rounded-full bg-white/10">LIVE →</span>
        </div>
        <div class="flex gap-3 items-center rounded-xl border border-white/10 p-3">
          <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-600 to-orange-600"></div>
          <div><div class="font-bold">GS Jewels</div><div class="text-xs text-white/60">Luxury e-com • 3D try-on concept • Craft CMS</div></div>
          <span class="ml-auto text-xs font-mono px-2 py-1 rounded-full bg-white/10">LIVE →</span>
        </div>
        <div class="flex gap-3 items-center rounded-xl border border-white/10 p-3">
          <div class="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600"></div>
          <div><div class="font-bold">MoodSync</div><div class="text-xs text-white/60">AI wellness SaaS • Real-time • Supabase</div></div>
          <span class="ml-auto text-xs font-mono px-2 py-1 rounded-full bg-white/10">BETA</span>
        </div>
      </div>
      <p class="text-xs font-mono text-white/40">Tip: this block was hidden behind the painting — just like good work hides behind the obvious.</p>
    `,
  },
  {
    id: 'clock',
    slot: 3,
    kicker: 'BLOCK 04 — PROCESS',
    title: 'How we work',
    icon: '◷',
    color: '#06b6d4',
    excerpt: '4 days, not 4 weeks.',
    puzzle: { type: 'code', code: '2025', clue: 'The year Blueblood was founded — look at the clock.' },
    hint: 'The clock is stuck. The time is a clue.',
    html: `
      <ol class="space-y-3">
        <li class="flex gap-3"><span class="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold shrink-0">1</span><div><div class="font-bold">Day 1 — Unpack</div><div class="text-white/60 text-xs">Figma audit, brand tokens, content map. No design without system.</div></div></li>
        <li class="flex gap-3"><span class="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-xs font-bold shrink-0">2</span><div><div class="font-bold">Day 2 — Build</div><div class="text-white/60 text-xs">AI-augmented codegen, shadcn primitives, motion pass.</div></div></li>
        <li class="flex gap-3"><span class="w-7 h-7 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-xs font-bold shrink-0">3</span><div><div class="font-bold">Day 3 — Polish</div><div class="text-white/60 text-xs">Perf audit, a11y, edge cases. 90+ Lighthouse or it doesn't ship.</div></div></li>
        <li class="flex gap-3"><span class="w-7 h-7 rounded-full bg-amber-500 text-black flex items-center justify-center text-xs font-bold shrink-0">4</span><div><div class="font-bold">Day 4 — Ship</div><div class="text-white/60 text-xs">Vercel deploy, domain, analytics. Live before lunch.</div></div></li>
      </ol>
      <div class="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs leading-relaxed"><b class="text-amber-400">Why this is in a clock?</b> Because process is time. We sell speed without sacrificing taste.</div>
    `,
  },
  {
    id: 'laptop',
    slot: 4,
    kicker: 'BLOCK 05 — CONTACT',
    title: 'Start a project',
    icon: '✦',
    color: '#ec4899',
    excerpt: 'One message away.',
    html: `
      <div class="grid md:grid-cols-2 gap-4">
        <div class="space-y-3">
          <div class="glass rounded-xl p-4">
            <div class="text-xs font-mono tracking-[0.15em] text-white/40">EMAIL</div>
            <div class="font-mono font-bold">hello@bluebloodstudio.com</div>
            <div class="text-xs text-white/50 mt-1">Response within 6 hours (IST).</div>
          </div>
          <div class="glass rounded-xl p-4">
            <div class="text-xs font-mono tracking-[0.15em] text-white/40">WHATSAPP</div>
            <div class="font-mono font-bold">+91 90000 00000</div>
            <div class="text-xs text-white/50 mt-1">Fastest way to kick off.</div>
          </div>
        </div>
        <form onsubmit="return false" class="glass rounded-xl p-4 space-y-3">
          <input placeholder="Your name" class="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500" />
          <input placeholder="Email" class="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500" />
          <textarea placeholder="Project in one line" rows="3" class="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm placeholder:text-white/30 focus:outline-none focus:border-amber-500"></textarea>
          <button class="w-full py-2.5 rounded-full bg-white text-black font-bold text-sm hover:bg-white/90">Send Inquiry →</button>
          <div class="text-xs text-white/40 text-center">This is demo content — but the vibe is real.</div>
        </form>
      </div>
    `,
    hint: 'The laptop screen is glowing.',
  },
  {
    id: 'safe',
    slot: 5,
    kicker: 'BLOCK 06 — MANIFESTO',
    title: 'The Blueblood Way',
    icon: '⬣',
    color: '#f59e0b',
    excerpt: 'Taste >> trend.',
    puzzle: { type: 'code', code: '0420', clue: 'Combine the first letters of the other 5 blocks? No — count the glowing objects left. Or: the safe needs 0420.' },
    hint: 'The safe has a 4-digit code. Hints are in the other blocks.',
    html: `
      <div class="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-black p-6">
        <div class="text-xs font-mono tracking-[0.2em] opacity-60">MANIFESTO — READ ALOUD</div>
        <p class="mt-3 font-display text-xl font-bold leading-tight">We don't sell websites.<br/>We sell the feeling after it loads.</p>
        <p class="mt-3 text-sm leading-relaxed opacity-80">Speed is respect. Taste is leverage. The last 5% is the whole game. If it doesn't give you chills, it doesn't ship.</p>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="glass rounded-xl p-3"><div class="font-black text-lg">17</div><div class="text-xs font-mono text-white/50">LIVE PRODUCTS</div></div>
        <div class="glass rounded-xl p-3"><div class="font-black text-lg">90+</div><div class="text-xs font-mono text-white/50">LIGHTHOUSE</div></div>
        <div class="glass rounded-xl p-3"><div class="font-black text-lg">&lt;2s</div><div class="text-xs font-mono text-white/50">LCP</div></div>
      </div>
      <p class="text-xs font-mono text-white/40">You found the final block. The exit is now unlocked.</p>
    `,
  },
];
