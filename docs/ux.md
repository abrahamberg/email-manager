# Control panel: UX and user journey

Status: **proposal**, implemented as a clickable mock in `web/` (mock data, no backend).

## 1. What the user actually wants

Nobody wants to "do email". They want three things:

1. **Not miss** what matters.
2. **Not spend time** on what doesn't.
3. **Be sure** that what was done on their behalf was right.

A traditional client shows a list of messages and lets the user do the work.
This is a **layer on top of email**, not a smarter inbox. The unit is **a thing
in the user's life** ("Elsa's trip to Skansen", "Contoso renewal"), not a
message. Many emails fold into one thing, and email only appears as the source
behind it.

Everything that arrives lands in one of three tiers:

| Tier | What it is | How it shows |
|---|---|---|
| **Don't miss** | Few. Costs something if ignored: a deadline, money, someone waiting, a decision only the user can make | Top of Today, one card at a time, chased until closed |
| **Worth knowing** | Reporting back: what changed, what the assistant did | A few lines on Today, nothing to do |
| **Not worth your time** | Most mail | One line with counts; "Skipped mail" if curious |

## 2. Principles

1. **Things, not messages.** Home shows only things that need the user,
   each one phrased as a question with an answer already prepared.
2. **One recommended action, pre-selected.** The default path is one key or
   one tap (`Enter`). Everything else is secondary.
3. **A finish line.** The user sees how many decisions are left and roughly how
   long they take ("4 decisions, about 3 minutes"), then a done state.
   No unread counters anywhere.
4. **Receipts for everything.** Every automatic action has a one-line reason
   (which rule, which signal, what the AI concluded), a confidence, and Undo.
   Correctness is visible, not promised.
5. **Teach once.** Every correction offers to become a rule ("Always do this
   for this sender?"). The user never corrects the same thing twice.
6. **Delegate the delegating.** The user doesn't configure automation up front.
   Each category of mail has an autonomy level, and the system itself proposes
   raising it once it has proven accurate ("I was right on 42 of 42 newsletter
   decisions. Handle these on my own from now on?"). Lowering is one click.
7. **Spot checks instead of reviews.** The system picks the few automatic
   decisions it was least sure about and asks a yes/no question. That is how
   correctness is maintained without reading everything.
8. **Ask, don't search.** A command bar (`/` or `Ctrl K`) takes plain language:
   "what did the bank send this week", "unsubscribe from all marketing",
   "tell Anna I'm running late". The answer comes back as a proposed action to
   confirm.
9. **Calm.** Quiet colours, no badges except "needs you", nothing moves unless
   the user acts.

## 3. Autonomy levels

Per category (newsletters, receipts, meeting requests, notifications, known
contacts' questions, …):

| Level | What the system does |
|---|---|
| **Watch** | Does nothing, shows what it would do. Default in dry-run. |
| **Suggest** | Prepares the action, user approves it on Today. |
| **Act and tell me** | Does it, lists it in Handled with Undo. |
| **Act quietly** | Does it, only visible in Handled when searched. |

Rules: sending mail never goes above **Suggest** unless the user raises it
explicitly. Deleting mail is never automatic.

## 4. The user journey

### First week (trust building)
1. Connect the mailbox (Settings). Dry-run is on: nothing is touched.
2. Each day Today shows "What I would have done" as receipts and spot checks.
3. After a few days, the system proposes autonomy levels per category based on
   how many spot checks it got right. The user accepts with one click.

### A normal day (2 to 5 minutes)
Today reads like a note from a chief of staff:

1. "Of 52 emails since 09:00, **6 are things you shouldn't miss.** I took care
   of the rest."
2. **Ask box**: questions and search by meaning (see below).
3. **Don't miss**: one card about the thing (area, deadline, what is needed,
   the prepared answer), then the other things as one line each. The card ends
   with "From Anna Lind" (opens the source email) and "Why I'm asking". Card
   types: reply ready, your choice, add to tasks, follow up. When they are done,
   the **quick checks** take their place, then "Nothing you'd miss".
4. **Worth knowing**: "The Atlas cutover moved to Mon 7 Dec." "I answered 4
   parents' group emails."
5. **Picked for you**: noisy streams reduced to what matches (see below).
6. **Not worth your time**: "40 emails didn't need you: 14 newsletters, 11
   promotions…"

Rule proposals are about how the assistant works, not the user's life, so they
wait in Delegation. Dates live on What I know.

### When curious or worried
- **Handled**: everything done automatically today, grouped by outcome, each
  with its reason and Undo, and "Always / Never" to teach.
- **Skipped mail**: low-value mail as one line per item, read when there is time.
  Mute, unsubscribe or promote a sender from there.

### Noisy streams with a few good items
Job alerts, newsletters, property alerts: many items, a few worth seeing. The
same mechanism handles all of them, nothing is job-specific:

1. **Detect the stream** with logic (same sender, bulk headers, frequency).
2. **Split each email into items** (one job, one article): a parser for known
   formats, a cheap AI extraction otherwise.
3. **Match items to the user's interests**, taken from What I know (e.g. the
   job search note), using embeddings.
4. **Show the minimum**: "LinkedIn job alerts · 2 of 34 this week worth a
   look", each pick with title, three facts, one line on why, and a closing date
   if any. The rest is one line: "32 others: mostly frontend, crypto…".
5. **Learn**: "More like this" and "Not for me" adjust the interest. A stream
   with no matches for weeks gets an unsubscribe suggestion.

AI writes only the "why" line for the top few. A pick moves to Don't miss only
when time matters (closing soon, a company already in contact).

### Asking instead of searching
- The ask box on Today (and the command bar, `/`) answers questions from what
  the assistant learned: "When is my tire change?" gives "Tue 24 Nov at 13:00,
  Industrivägen 12, Solna" with the email it came from.
- A plain topic searches by meaning, not words: "programming" finds the Java
  job alert, the Nordpay case and the Kotlin meetup. The mock uses a small
  concept map; the server will use embeddings.

### Weekly
- **Delegation** shows accuracy per category and the system's suggestions to
  raise or lower autonomy, plus all rules in plain language, their sources and
  pending AI proposals.

## 5. Screens

| Screen | Purpose |
|---|---|
| **Today** | One-line verdict, ask box, don't miss, worth knowing, not worth your time |
| **What I know** | Each life area: summary, what was handled today, the user's note, people, learned facts with source; correct, forget, or add an area |
| **Handled** | Receipts of automatic actions, undo, teach |
| **Skipped mail** (digest) | Low-value mail summarised, sender actions |
| **Tasks** | Mine (from mail, with due dates) and Waiting on others |
| **Delegation** | Autonomy per category, rules, AI proposals, rule sources |
| **Activity** | Runs, counts, tokens and cost, errors |
| **Settings** | Mailbox, dry-run, send limits, quiet hours, AI budget |
| **Set up** | Connect, learn from 30 days read-only, a watch week, a starting preset |
| Email drawer | Any email in full, with the step-by-step trace of how it was decided |
| Command bar | Plain-language questions and actions, from any screen |

## 6. Areas and memory

The assistant keeps a small model of the user's life: **areas** (a name, a
summary it rewrites each run, the user's own note, and the people involved)
and **facts** (appointments, deadlines, addresses) each tied to the email it
came from. Mail is sorted into areas, replies use the notes ("Elsa has a nut
allergy"), and answers cite their source. Everything is visible and editable on
**What I know**; a forgotten fact is never used again.

## 7. How correctness is backed

"Do as little as possible" only works if the user can trust what happened.
Every place in the panel answers *why*:

- **Decision trace.** Opening any email shows the four pipeline steps (your
  rules, spam check, bulk and repeat check, AI), which one decided, what it
  saw, and how many tokens the AI used. "Decided without AI, at no cost" is
  shown when that's the case.
- **Sender checks.** SPF, DKIM and DMARC verdicts and the spam score.
- **Rules preview.** While writing a rule, the editor shows which of today's
  emails it would catch, so a rule is tested before it runs. Rules are saved
  as conditions and shown as one plain sentence.
- **Reply limits.** Replies sent without asking are limited to topics the
  user ticks (for example "confirm appointments that match my calendar"), to
  people they have written to before, never to listed domains, under a daily
  cap and outside quiet hours.
- **Presets never send.** Even "Hands-off" keeps replies at Suggest. Sending on
  its own is only ever a choice the user makes per category.

## 8. Keyboard

| Key | Action |
|---|---|
| `Enter` | Do the recommended action |
| `O` | Open the email in full |
| `1`–`3` | Pick an option on a choice card |
| `E` | Edit (draft or task) |
| `S` | Snooze until next briefing |
| `X` | Dismiss / don't do it |
| `Z` | Undo the last action |
| `/` or `Ctrl K` | Command bar |
