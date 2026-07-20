# Sprint 1 — Module 1: SHG Product Registry + Admin

_A plain-language summary of what Sprint 1 was for and what we finished, written for someone with no technical background. Reviewed at the end of the sprint._

## Sprint 1 — the goal

Sprint 0 built the foundation — the blueprint, the database, the construction site, the look-and-feel, the front door with ID checks. Sprint 1 is where the building actually gets its **first real room**: the place where an SHG (Self Help Group) signs up and lists the products they make, so the platform has something real in it for every later feature (buyer matching, dashboards, forecasting) to work with.

By the end of this sprint: an SHG can register on their phone, add products with photos, the system can suggest which category a product belongs to on its own, and a government official/admin can see and manage all of that from one place.

## What we actually did, in plain terms

**T06 — The registry's back office.** Built the server-side machinery for SHGs and their products: create, view, edit, delete. Product photos get checked for viruses, resized, and stored properly. Every SHG and product gets a map location, so later features like "find buyers near me" have something to work with.

**T07 — The registry's front counter.** Built the actual screens an SHG member uses on their phone: a sign-up form, a product catalogue, and — since many SHG members are more comfortable speaking than typing — the ability to take product photos straight from the phone's camera. Built to work in patchy network conditions: if the signal drops mid-registration, the entry is saved locally and sent automatically the moment the connection comes back, so nobody has to redo their work. Available in both Telugu and English.

**T08 — A helping hand with categorizing products.** When an SHG member types in a product name (say, "Mango Pickle"), the system now suggests which shelf it belongs on — "Pickles," under "Food Products" — instead of making the member hunt through a long list themselves. It's a suggestion only: the member can always pick something different. Under the hood this works by comparing the _meaning_ of the words (not just exact spelling) against the category list, using the same kind of technology behind modern translation and search tools. We found it's noticeably better at this in English than in Telugu script right now, so when it isn't confident, it stays quiet instead of guessing wrong — see the "how the AI suggestion works" section below.

**T09 — The admin's control room.** Built the screens a government official or platform admin uses: a dashboard showing how many SHGs, products, and users are registered; searchable lists of all three with the ability to suspend a problem account, deactivate a fraudulent SHG, or hide a product that shouldn't be listed; and a screen to manage the platform's shared reference data — the list of districts, ULBs, mandals, product categories, and the festival calendar (used later to predict demand spikes around festivals). Different officials see different amounts of this — a district officer sees just their district, while an admin sees everything and is the only one who can edit the shared reference data.

Everything from this sprint plugs directly into what comes next: Sprint 2's voice assistant will let SHG members do all of this by _talking_ instead of typing, and the AI market-intelligence features later in the project will run on the real product/SHG data collected here.

---

## How does the AI category suggestion actually work? (Beginner explanation)

T08 is the first "AI" feature in the platform, so it's worth explaining simply what's actually happening — because it's a lot less mysterious than it sounds.

### The problem it solves

There are 22 product categories (Pickles, Bamboo Craft, Cotton Sarees, and so on). Asking every SHG member to correctly pick the right one from a long list is slow and error-prone — especially for someone who isn't used to using apps. We want the system to make a good guess automatically.

### How it works, without the jargon

Imagine every product name and every category name gets turned into a "fingerprint" — a long string of numbers that captures what the words _mean_, not just how they're spelled. Two fingerprints that are close to each other mean the two texts are about similar things.

So when someone types "Mango Pickle":

1. The system creates a fingerprint for "Mango Pickle."
2. It already has fingerprints ready for all 22 categories (like "Pickles," "Bamboo Craft," etc.).
3. It compares the new fingerprint against all 22 and picks the 2-3 closest matches.
4. It shows those as suggestions — the SHG member taps one, or ignores them and picks manually.

This is the same underlying idea used by things like Google Translate or a search engine's "did you mean...?" feature — comparing meaning, not just spelling.

### Why it isn't perfect yet, and why that's OK

We tested this for real (not just in theory) against the actual product list, and it works well for English text — "Mango Pickle" correctly matches "Pickles," "Cotton Saree" correctly matches "Cotton Sarees," with high confidence. But when we tried the same thing in Telugu script, the fingerprint-matching was much weaker, because the category names themselves are only stored in English right now.

Rather than show a confident-looking suggestion that's actually wrong, we set a rule: if the system isn't confident enough, it shows _nothing_ rather than a bad guess — the SHG member just picks the category manually, same as always. A wrong-but-confident-looking suggestion would be worse than no suggestion at all, especially for someone who trusts the app to know what it's doing.

### The simplest way to think about it

**It's a spell-checker for meaning, not spelling** — a helpful nudge in the right direction, not a decision-maker. The human always has the final say, and when the system genuinely doesn't know, it says nothing instead of guessing.
