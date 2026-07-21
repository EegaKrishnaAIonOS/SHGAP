# Sprint 2 — Module 2: Voice AI Assistant + Module 6: Notification Engine

_A plain-language summary of what Sprint 2 was for and what we finished, written for someone with no technical background. Reviewed at the end of the sprint._

## Sprint 2 — the goal

Sprint 1 gave SHG members a real product registry — but only by typing into forms. Many SHG members are far more comfortable _speaking_ than typing, especially in Telugu, so Sprint 2's biggest piece of work was building a real voice assistant: something an SHG member can talk to, in Telugu or English, to register a product, check a price, or ask about a government scheme. Alongside that, this sprint also built the platform's notification engine — the machinery that actually sends an SMS, WhatsApp message, voice call, or email when something happens that a member or official needs to know about.

By the end of this sprint: an SHG member can have a real spoken (or typed) conversation with the assistant that does real things in the product registry and answers real questions about government loan schemes with sources; and the platform can send a real OTP login code over SMS through a proper, swappable notification pipeline instead of a placeholder that just wrote the code to a log file.

## What we actually did, in plain terms

**T10 — Teaching the assistant to listen and speak.** Built the actual voice pipeline: capturing the member's speech, turning it into text, understanding what they're asking for, and speaking a reply back — all over a live phone-call-like connection (the same underlying technology video-calling apps use, not a walkie-talkie style "press to record, wait, get a reply"). The assistant can register a new product or look up the price of one of the member's own products, entirely by voice, in Telugu or English.

**T11 — Checking how well the assistant actually understands Telugu.** Rather than assume the voice pipeline works, we tested it for real: how often does it correctly figure out what the member is asking for, and how accurately does it turn spoken Telugu into text? We also added a cleanup step for typed input, since people often type Telugu using English letters ("nenu mamidi pickle" instead of "నేను మామిడి పికల్") — the assistant now tidies that up into proper Telugu script before acting on it. We found and documented real weaknesses honestly (an occasional garbled response, and trouble with the acronym "MEPMA" itself) rather than only reporting the good numbers.

**T12 — Scheme guidance and a real assistant screen.** SHG members regularly need to know about government loan/credit schemes — this sprint taught the assistant to actually answer those questions, grounded in real information about six real schemes (DAY-NULM, Vaddi Leni Runaalu, PM SVANidhi, SthreeNidhi, PM Mudra Yojana, and MEPMA's own program), always citing which scheme an answer came from, and honestly saying "I don't have information on that" rather than guessing when a question falls outside what it actually knows. This sprint also replaced the placeholder assistant screen from Sprint 0 with the real thing: a big microphone button, a live waveform, a running transcript, a typed-message option for members who'd rather type (or who are on a slow connection), and a Telugu/English switch.

**T13 — Making notifications actually send.** Built the real machinery behind sending an SMS, WhatsApp message, voice call, or email: a queue that retries automatically if a send fails, a record of every notification that was ever attempted (and whether it succeeded), and the actual connections to the SMS/WhatsApp/voice-call/email providers the project picked back in Sprint 0. The very first thing plugged into this is the login OTP code — it now genuinely goes through this real pipeline instead of a stand-in that just printed the code to a developer's screen. Some later notification types (like "a buyer is interested in your product") are ready to fire the moment the buyer-side features that would trigger them exist — see the honesty note below.

Everything from this sprint plugs directly into what's ahead: the market-intelligence and buyer-matching sprints will use this same notification pipeline to alert members about demand and price changes, and the same voice assistant will grow to cover those features too as they're built.

---

## How does the voice assistant actually work? (Beginner explanation)

### The problem it solves

Typing is a real barrier for many SHG members — not because they can't do it, but because speaking is simply faster and more natural, especially in their own language. We want a member to be able to just _talk_ to the app the way they'd talk to another person, and have it actually register a product or answer a question, not just play back a canned response.

### How it works, without the jargon

Think of the assistant as three specialists working together on every single thing the member says:

1. **A listener** turns the member's spoken words into written text — in Telugu or English, and it can even follow along if someone mixes both languages mid-sentence, which is extremely common in everyday speech.
2. **A thinker** reads that text and decides what to do with it — "this sounds like they want to register a product called Mango Pickle, priced at 100 rupees" — and either takes that action for real (through the same registry built in Sprint 1) or, for a scheme question, looks up real government scheme information before answering, rather than answering from memory.
3. **A speaker** turns the thinker's reply back into spoken audio, in the same language the member was using.

All three run over a live, continuous connection — like a phone call — so the conversation flows naturally instead of feeling like a series of separate button presses.

### Why "looks it up before answering" matters for scheme questions

For everyday chit-chat, a wrong guess is harmless. For "how much can I borrow under this government scheme," a wrong guess is genuinely harmful — someone could make a real financial decision based on it. So for scheme questions, the assistant doesn't answer from its own general knowledge at all. It first searches a small library of real, sourced scheme information (the same six schemes mentioned above), and only answers using what it actually finds there, always naming which scheme the fact came from. If nothing relevant turns up, it says so honestly instead of filling the gap with a plausible-sounding guess.

### Why this is being tested and reported honestly

Voice recognition and language understanding are never perfect, especially for a language like Telugu where there's less existing technology to build on than for English. Rather than only showcase the best examples, we ran real tests and wrote down the real numbers — including the cases where it didn't work well — so everyone building on top of this sprint's work knows exactly where the rough edges are, instead of finding out the hard way later.

## A note on honesty: what's real right now, and what's still ahead

Two things are worth being upfront about, because they matter for anyone relying on this sprint's work:

- **The four notification channels (SMS, WhatsApp, voice call, email) are built and tested against the real queue and database, but not yet tested against a real SMS/WhatsApp/phone/email account** — those require business paperwork (phone number registration, template approval, verified sending domains) that takes real-world time to set up, well beyond what a development sprint can complete. Until that setup happens, every channel automatically falls back to safely logging what _would_ have been sent, so nothing is silently broken or fails invisibly.
- **Not every notification type has something that triggers it yet.** The OTP login code is fully wired up and working end-to-end today. Notifications like "a buyer is interested in your product" are built and ready, but nothing in the platform yet creates that "a buyer is interested" moment — that arrives with the buyer-matching features in a later sprint. Rather than fake a trigger just to show it working, we're saying plainly: this piece is ready and waiting for the feature that will actually use it.
