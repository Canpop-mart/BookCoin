# BookCoin — Design Doc

> A self-hosted, family-only reading game. Log the time you read, earn **BookCoins**,
> climb a monthly leaderboard, take on quests that push you out of your comfort zone,
> and spend coins on real rewards — from silly to boba to video games.

**Status:** Design / pre-build · **Hosting:** Self-hosted on NAS · **Audience:** Family

---

## 1. Goals & non-goals

**Goals**
- Make reading feel rewarding and a little competitive, for a family of mixed ages and tastes.
- Incentivize **showing up** (consistency) and **branching out** (new genres/mediums), not just grinding easy books.
- Stay lightweight to log — a session should take seconds to record.
- Look and feel good: animations, satisfying progress, coins going *up*.

**Non-goals**
- Not a fraud-proof anti-cheat system. It's family — trust is the default; we add just enough friction that cheating feels pointless and obvious.
- Not a public/social network. Single private instance for one family.
- Not a full catalog/cataloguing app (Goodreads replacement). We track *reading activity*, not a library.

---

## 2. Players & trust model

- A handful of family members, all known to each other → **high trust**.
- Verification leans almost entirely on the **honor system + public logs**. The written summary is the real proof-of-reading (see §7).
- Auth can be minimal (per-member profile + simple PIN/passphrase on the LAN/VPN). No need for heavy account security on a private instance.

---

## 3. Core loop

1. **Start a reading session** → in-app timer runs (or enter minutes manually after the fact).
2. **Stop & log** → pick the work, format, genre(s); write a short summary; optionally add page count, a favorite quote, or a photo of the page you stopped on.
3. **Earn coins** → base earn for time read, plus any quest/variety/comfort-zone multipliers.
4. **Climb the board** → monthly points update live.
5. **Spend coins** → redeem rewards from the prize catalog.
6. **End of month** → rankings reset, rank bonuses paid out, all-time stats roll forward.

---

## 4. Scoring model

### Time is the spine
**Ranking is based on time read**, because it's the one metric that's fair across every format. An hour of dense prose and an hour of manga are both an hour of the habit we're rewarding.

- Reading sessions are tracked via an **in-app timer** with an occasional "still reading?" nudge so it can't just run all night. Manual entry allowed too (honor system).

### Pages are fun-only
Page count is an **optional secondary stat** — shown on profiles and as side leaderboards, but it does **not** drive ranking (and earns no coins, or only cosmetic flair). Keeps the "number go up" satisfaction without the fairness problems.

### Formats
Supported mediums, each with its own natural unit for *flavor* stats:

| Medium    | Primary (ranking) | Flavor stat        |
|-----------|-------------------|--------------------|
| Prose     | time              | pages, books done  |
| Manga     | time              | volumes, chapters  |
| Comic     | time              | issues             |
| Webtoon   | time              | episodes           |
| Audiobook | time              | (time only)        |

Because ranking is time-based, **comics/manga/webtoons and audiobooks all "just work"** — no per-format fudge factor needed. (Audiobooks become first-class for free, since they have no pages.)

---

## 5. Coin economy

Two distinct concepts — **don't conflate them**:

- **Points** = your monthly activity (time read). Drives the **monthly leaderboard**. **Resets** on the 1st.
- **Coins** = persistent, spendable currency. **Never reset** except by spending.

### Coins come from two places
1. **Base earn** — *everyone* earns coins just for reading. Always progressing toward a reward, win or lose. This is what keeps slower/younger readers in the game.
2. **Rank bonus** — top monthly finishers get a coin bonus *on top*. The competition is the spice, not the only income.

> **Design intent — the rhythm:** base earn is a steady *trickle*; quests (§8) are the *jackpots*. Reliable income from showing up, big bonuses from being adventurous.

### Money anchor (conscious ratio)
**100 coins = $1.** A solid ~15 hr reading month earns ~1,000 coins ≈ **$10 ≈ one boba** — so a dedicated month buys a real treat, and every reward's coin price has a clear dollar meaning. Reward-pricing UIs surface the `≈ $` equivalent so whoever sets a price does it consciously. Tunables live in `server/src/coins.js` (`COINS_PER_DOLLAR`, `BASE_COINS_PER_HOUR`).

### Numbers (all tunable — see coins.js)
| Source                         | Coins        |
|--------------------------------|--------------|
| Base earn                      | ~67 / hour read (≈ $0.67) |
| Comfort-zone log (new genre)   | base × 1.5   |
| Monthly rank: 1st / 2nd / 3rd  | +300 / 200 / 100 ($3 / $2 / $1) |
| Bonus star (most genres/sessions/pages/days/formats) | +100 each ($1) |
| Quests / challenges            | ~80–300 ($0.80–$3) |

Seed reward prices anchor to this: boba / $10 game credit = 1,000; new book = 1,500; movie night = 500; choose dinner = 400; skip a chore = 600.

---

## 6. Leaderboards & profiles

- **Monthly board** — this month's points (time). Resets on the 1st; pays rank bonuses at close.
- **All-time board** — cumulative, never resets. Pure bragging rights.
- **Profile** — full log history, lifetime stats per format, badges, streaks, coin wallet.
- Optional **side boards** for fun stats (pages, books finished, longest streak).

### Mixed reading levels (kids + adults)
Raw time still favors whoever has more free time / reads faster. Two leveling options:
- **Personal monthly goals** — everyone competes against their *own* target; "% of goal hit" is its own board. The wholesome version — anyone can "win" by beating themselves.
- **Handicap multiplier** — optional per-member multiplier for younger readers.

Recommendation: start with **personal goals**; add handicaps only if needed.

---

## 7. Verification (kept deliberately light)

Family = high trust, so we mostly rely on Tiers 0–1. Higher tiers are optional/future.

- **Tier 0 — Social honor (foundation):** logs (incl. summaries) are visible to the whole family. Peer reactions (👍 🔥 🤨). Public accountability does most of the work.
- **Tier 1 — Cheap proof:** the **written summary** is the core mechanism; optional **quote capture** (can't quote what you didn't read) and **page photo** (BeReal-style).
- **Tier 2 — Sanity checks (automatic):** the in-app **timer** (measures time instead of trusting it) + **velocity flags** for implausible page rates. Flag, don't block.
- **Tier 3 — Real data (future/optional):** integrations (StoryGraph / Hardcover / Kindle / Goodreads) for verified progress; an optional **LLM summary spot-check** that grants a *bonus* when passed (audit-as-reward, never a gate).

---

## 8. Quests & challenges

The breadth engine. Pure time-tracking rewards comfort food; quests reward range.

### 8.1 Curated lists ("verified lists")
A list is a predefined set of works; logging against one grants a bonus + badge. Verification = same honor + summary.
- **The Canon** — classics, award winners (Pulitzer / Hugo / Booker), "1001 books" type sets.
- **Family Canon** — *each member adds 3–5 favorites; reading someone else's pick pays extra.* The wholesome heart of the app — reading as a way to connect.
- Completing a whole list → tier badge + coin jackpot.

### 8.2 Personalized comfort-zone multiplier
Because we log everything, "out of your comfort zone" is computed **per person** from their own history. 200 hrs of fantasy and zero nonfiction? Your first nonfiction log gets a fat multiplier. Personalized, and basically free once logs are tagged. (Something a generic reading app can't do.)

### 8.3 Variety combos
- **Genre Rainbow** — N distinct genres in a month → escalating bonus / jackpot at the full set.
- **Medium Hopper** — prose + manga + audiobook in one month → bonus.
- **Guardrail:** award variety bonuses on *finishing* a work or crossing a time threshold (e.g. 30+ min), **not** on merely touching a genre — otherwise people farm 2-minute dabbles.

### 8.4 Family bounties (member-authored)
Anyone can post a challenge with a coin reward: *"Whoever finishes Dune this month gets 500 coins."* Keeps the quest pool alive, personal, and self-curated.

### 8.5 Monthly themes
One shared goal everyone chips at — "Nonfiction November," "Spooky October."

### 8.6 Badges
Awarded for list completion, streaks, comfort-zone milestones, etc. Shown on profile.

---

## 9. Rewards

A tiered prize catalog, silly → meaningful:
- **Low tier (honor system):** silly/cheap perks — pick the next family movie, a "skip a chore" token.
- **Mid tier:** boba, a book of your choice.
- **High tier:** video games, bigger items.

> Higher-value rewards are where light **Tier 1 proof** (§7) earns its keep; cheap rewards can stay pure honor system.

Redemption flow: member requests a reward → coins held/deducted → admin marks fulfilled.

---

## 10. Data model (first cut)

```
User
  id, name, avatar, role (admin|member), pin
  monthlyGoalMinutes?, handicapMultiplier?
  createdAt

Work                      # lightweight; title/author may also be free-text on a log
  id, title, author, medium (prose|manga|comic|webtoon|audiobook)
  defaultGenres[], coverImage?

ReadingSession            # one log entry
  id, userId, workId? (or freeText title/author)
  medium, genres[]
  startedAt?, durationMinutes        # primary metric
  pages?                             # optional, fun-only
  summary (text, required)
  quote?, photoUrl?                  # optional proof
  listRefs[]                         # which curated lists this counts toward
  flags[]                            # e.g. "velocity-sus"
  createdAt

List                      # curated / family-canon / theme
  id, name, type (canon|family|theme), curatorId
  items[] -> Work

Quest
  id, type (list-completion|comfort-zone|variety|bounty|theme|streak)
  title, description, period (e.g. 2026-06), criteria (json)
  rewardCoins, rewardBadgeId?
  authorId?              # set for bounties
  status

CoinTransaction           # the wallet ledger
  id, userId, amount (+/-), reason (base-earn|rank-bonus|quest|spend|adjust)
  refId?, createdAt

Reward                    # prize catalog
  id, name, costCoins, tier, stock?

Redemption
  id, userId, rewardId, status (requested|fulfilled|cancelled), createdAt

Badge / UserBadge         # earned badges
```

**Why tag medium + genres + listRefs from day one:** quests, the comfort-zone multiplier, and variety combos all depend on them. Cheap to add now, painful to retrofit.

Leaderboards can be **computed on the fly** from `ReadingSession` + `CoinTransaction` (no separate standings table needed at this scale).

---

## 11. Tech & hosting

- **Shape:** a small web app in a **Docker container** on the NAS (you already self-host this way).
- **Stack (suggested):** SvelteKit *or* Next.js + **SQLite** (single file → trivial NAS backups) via Drizzle/Prisma.
- **UI:** **mobile-first PWA** (installable, no app store) so logging from a phone is one tap. This is also where the animations live.
- **Auth:** simple per-member PIN; instance reachable over LAN/VPN.

---

## 12. Build phases

**Phase 1 — MVP (the core loop is fun on its own)**
- Members + simple auth
- Log reading: timer + manual entry; medium, genre(s), required summary; optional pages
- Coin wallet (base earn only)
- Monthly + all-time leaderboard (by time); profile with history

**Phase 2 — The game**
- Quests: curated lists, comfort-zone multiplier, variety combos
- Family bounties + monthly themes; badges
- Rewards catalog + redemption + rank bonuses

**Phase 3 — Polish & proof**
- Animations / juice
- Optional proof: quote capture, page photos, velocity flags
- Integrations (StoryGraph / Hardcover / Kindle); optional LLM spot-check

---

## 13. Open questions / revisit

- Exact coin rates & multipliers (the §5 table is a strawman — tune after a month of real use).
- Personal goals vs handicaps for kids — start with goals, decide later.
- How "finishing a work" is detected for variety guardrails (mark-as-finished button vs page %).
- Whether base earn should taper (anti-binge) or stay linear.
- Genre taxonomy — fixed list vs free tags vs pull from an integration.
