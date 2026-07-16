# Sprint 0 — Foundation & Architecture

_A plain-language summary of what Sprint 0 was for and what we finished, written for someone with no technical background. Reviewed at the end of the sprint._

## Sprint 0 — the goal

Think of building this whole platform like constructing a building. Before you build the actual rooms (registration pages, voice assistant, dashboards, etc.), you need:

- A blueprint (architecture)
- The foundation and plumbing (database, servers)
- A construction site with proper scaffolding, safety checks, and tools (repo setup, automated checks)
- A basic look-and-feel guide (design system)
- A working front door with ID verification (login/security)

That's exactly what **Sprint 0 "Foundation & Architecture"** was for — nothing user-facing yet, just the solid groundwork everything else gets built on top of.

## What we actually did, in plain terms

**T01 — The blueprint.** Drew diagrams showing who uses the system (SHG members, government officials, buyers) and how all the pieces (website, mobile app, voice assistant, databases) talk to each other. Also wrote down _why_ we chose each technology (e.g., "we're using this database because it can handle maps and AI data together").

**T02 — The filing cabinet.** Designed the actual database — every "drawer" for storing SHGs, products, buyers, sales, users, etc. Set it up so it can store GPS locations (for "find nearby buyers") and AI data (for recommendations). Filled it with real starter data: the 3 pilot districts, their local areas, and product categories.

**T03 — The construction site.** Set up the project structure so 5 different pieces of software (website, main server, notification system, and 2 AI services) can all live in one organized repo, be built, tested, and packaged consistently. This is also where we set up the **CI/CD** system (explained below).

**T04 — The look and feel.** Built reusable visual building blocks (buttons, cards, tables, popups, charts) and rough sketches of every screen — registration, product catalogue, voice assistant, and all the official dashboards. Also made sure everything works in both Telugu and English, since SHG members are Telugu-first users.

**T05 — The front door and ID check.** Built the login system: users type their phone number, get an OTP (like any banking app), and log in. Then set up permissions — an SHG member sees only their own stuff, a district officer sees only their district's data, an admin sees everything. This is the security layer everything else will plug into.

Nothing here is "the real app" yet — it's all the groundwork. Sprint 1 onward is where actual features (product registration, buyer matching, etc.) get built on top of this foundation.

---

## What is CI/CD? (Beginner explanation)

**CI/CD** stands for **Continuous Integration / Continuous Deployment**. Strip away the jargon and it's really just: **"automatically check the code every time someone changes it, so mistakes get caught immediately instead of days later."**

### The problem it solves

Imagine 5 people are writing different parts of this app. Without CI/CD:

- Someone writes code, thinks it works, and pushes it
- Nobody actually re-checks it works with everyone else's code
- Weeks later, someone tries to run the whole app and it's broken — but _nobody knows which change broke it_, because dozens of changes happened since anyone last checked

That's expensive and stressful to debug.

### How CI/CD fixes it

Every single time code is pushed to GitHub, a robot (GitHub Actions, in our case) automatically:

1. **Downloads the code fresh**, like a stranger would
2. **Lints it** — checks for sloppy/inconsistent code style
3. **Tests it** — runs a bunch of small automated checks like _"does the login endpoint actually reject a wrong password?"_
4. **Builds it** — makes sure the code actually compiles/packages without errors
5. **Packages it into a container image** — a ready-to-run box that can be shipped to a server

If **any** of those steps fail, the robot immediately flags it: _"Hey, this specific change broke something."_ You find out in minutes, not weeks, and you know exactly which commit caused it.

### Why it mattered concretely in our work

This isn't theoretical — it caught **real bugs** while we were building T03 and T05:

- It caught that our code-style checker didn't work on its own config file
- It caught that our Docker packaging step was looking for files in the wrong folder
- It caught that one of our security libraries wasn't compatible with the container's operating system

Every one of those would have been a nasty surprise later (maybe even after the app was already handed to the government for testing). Instead, the robot caught them within minutes of pushing, we fixed them, and moved on.

### The simplest way to think about it

**CI/CD is an automatic, tireless quality-control inspector** that re-checks the whole app every time anything changes, so broken code never quietly slips through — which matters a lot for a government platform that needs to actually work reliably for real SHG members.
