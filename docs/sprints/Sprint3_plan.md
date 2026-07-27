# Sprint 3 — Module 3: AI Market Intelligence + Module 4: Buyer Matching Engine

_A plain-language summary of what Sprint 3 was for and what we finished, written for someone with no technical background. Reviewed at the end of the sprint._

## Sprint 3 — the goal

The first two sprints gave SHG members a real product registry and a real voice assistant. Sprint 3 is where the platform starts being genuinely "AI-enabled" in the way the project's name promises: it builds the machinery that looks at real sales history and market prices to predict what will sell and for how much, the registry of buyers (shops, institutions, government departments) who might want to buy from SHGs, and — bringing both of those together — a recommender that tells an SHG "here are the buyers most likely to want what you make, and here's why."

By the end of this sprint: the platform can forecast demand and price trends per product, spot geographic hotspots of activity, hold a real registry of buyers with their interests and typical order sizes, and generate a ranked, explained list of buyer recommendations for any SHG — with a working accept/reject button so SHGs can tell the platform whether a recommendation was actually useful.

## What we actually did, in plain terms

**T14 — Building the data pipeline everything else in this sprint depends on.** Before any forecasting or matching can happen, the platform needs clean, organized data to work from: real sales history, real government mandi (market) prices pulled from the official Agmarknet data source, festival/demand-season dates, and geographic location data. This task built that pipeline — it runs on a schedule, pulls in fresh data, and turns it into the tidy feature tables every later step reads from. Along the way we found and worked around several real, undocumented quirks in the government price data source (it only ever gives you today's prices, not history; it silently caps how many records you can request at once; and it silently times out requests that look too much like an automated script) — genuine discoveries, not assumptions, that anyone else building on this data source would hit too.

**T15 — Teaching the platform to forecast demand and price.** Using the data pipeline from T14, this task built two real forecasting models: one that predicts how much of a given product will sell in the coming weeks (accounting for weekends and festival season), and one that predicts price trends for market commodities. Both models are honestly tested against real held-out data (never just checked against the same data they were trained on) and openly report their own accuracy rather than just claiming to work. This task also built a "hotspot" feature that shows where on the map demand is concentrated, and a plain "what sells best on which day of the week" report.

**T16 — Building the buyer registry.** This task built the actual database of buyers — institutional buyers, retail shops, bulk wholesalers, and government procurement departments — including what categories of product each one is interested in, their typical order size and price range, and where they're located. It also added a way to bulk-import many buyers at once, and seeded the platform with a realistic starting set of sample buyers (including simulated government e-marketplace tender opportunities) so the recommender in T17 would have real buyers to recommend.

**T17 — The recommender itself: matching SHGs to buyers, with reasons.** This is where T14, T15, and T16 all come together. For any SHG, the platform now looks at every real buyer in the registry and works out how good a match each one is — based on how similar the SHG's products are to what the buyer is looking for, whether the buyer has explicitly said they're interested in that product category, whether the price fits the buyer's usual range, how far away the buyer is, and how much demand is forecast for that product. It then shows the SHG a ranked list of buyers with plain-English reasons for each match ("this buyer has said they're interested in Pickles"; "priced within this buyer's usual range"; "only 12km away"), and lets the SHG accept or reject each recommendation — which matters, because every accept/reject is being saved so the recommender can genuinely learn and improve over time, once enough of those real decisions have piled up.

Everything from this sprint plugs directly into what's ahead: officials' dashboards (a later sprint) will show these same forecasts and hotspots at a district/state level, and every accept/reject decision SHGs make on recommendations becomes the training data that makes the recommender smarter over time.

---

## How does the buyer recommender actually work? (Beginner explanation)

### The problem it solves

An SHG might make a wonderful product, but have no idea which of the many possible buyers out there would actually want it, at what price, or how much of it. Left alone, that's a lot of guesswork and cold-calling. The recommender's job is to do that matching automatically and tell the SHG, in plain language, _why_ it thinks a particular buyer is a good fit — not just hand over a mysterious score with no explanation.

### How it works, without the jargon

Think of it as scoring every buyer against every one of an SHG's products on four real, checkable things:

1. **Does this sound like what the buyer wants?** The platform reads the product's name, category, and description, and compares it to what the buyer says it's interested in — similar to how you'd tell two product descriptions are "about the same kind of thing" just by reading them.
2. **Has the buyer explicitly said they're interested in this category?** If a buyer has told the platform "we buy Pickles," and this product is a pickle, that's a strong, honest signal — not a guess.
3. **Does the price fit what this buyer usually pays?** Buyers can state a typical price range; a product priced well outside that range is probably not a great match today, even if everything else lines up.
4. **How far away is the buyer?** All else being equal, a buyer close to the SHG is a more realistic match than one on the other side of the state — except for buyers like government departments who aren't tied to one location at all, where distance isn't held against them.

Those four things combine into a single match score, and the platform also pulls in the demand forecast built in T15 to show roughly how much of that product the buyer might realistically want. Every one of those four things is shown back to the SHG as a plain-language reason, so "why did you recommend this buyer" always has a real, honest answer.

### Why there's no "black box" AI model doing the matching yet

A fancier version of this recommender could use machine learning to _learn_ buyer preferences from real past matches that worked out. We deliberately didn't build that part yet — because it doesn't exist to learn from. No SHG has accepted or rejected a recommendation before this sprint, so there's no real history yet for a learning model to learn from. Building one anyway would mean the model is just memorizing random noise and calling it insight, which would be dishonest dressed up as "AI." Instead, today's matching uses the four real, explainable factors above, and the moment enough real accept/reject decisions pile up (the platform is already tracking every one), it will automatically start training a real learning model on top — without anyone needing to touch the code again.

## A note on honesty: what's real right now, and what's still ahead

- **The demand and price forecasts are real, trained models — but the price forecast can't run today.** The demand forecasts (T15) are genuinely trained on the platform's real sales history and produce real predictions. The price forecast's underlying mechanism was built and proven correct, but the real government price data it needs hasn't accumulated enough history yet (the source only gives one day of prices at a time, and a shared testing key hit its usage limit during our own development). This isn't hidden — the price forecast will honestly say "not enough data yet" rather than making something up, and will start working for real as more days of price data accumulate.
- **The buyer-matching recommender uses real, explainable rules today, not a trained AI model — and that's a deliberate, temporary choice, not a shortcut.** As explained above, there's no real history of accepted/rejected recommendations yet for a learning model to train on. The platform is built to start training a real one automatically the moment enough SHGs have used the accept/reject buttons — this sprint built the button and the tracking, not just the promise of it.
- **The buyer registry is seeded with a realistic starting set of sample buyers, clearly labeled as such**, including simulated (not yet real) government e-marketplace tender listings — real integration with the actual government e-marketplace system is planned for a later sprint focused specifically on outside-system integrations.
