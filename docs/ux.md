# Control panel: UX and user journey

Status: **proposal**, implemented as a clickable mock in `web/` (mock data, no backend).

## 1. What the user actually wants

Nobody wants to "do email". They want three things:

1. **Not miss** what matters.
2. **Not spend time** on what doesn't.
3. **Be sure** that what was done on their behalf was right.

A traditional client shows a list of messages and lets the user do the work.
Here the system does the work and the user only does what the system cannot
decide alone. So the unit of the interface is **a decision, not a message**.

## 2. Principles

1. **Decisions, not messages.** Home shows only things that need the user,
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
1. Open the app. **Briefing**: "Since 08:00, 52 emails arrived. 47 handled.
   4 need you, about 3 minutes. 2 quick checks."
2. Work through the **decision stack**, one focused card at a time:
   - *Reply ready*: a draft written in the user's tone. `Enter` sends, `E`
     edits, `X` don't reply.
   - *Your choice needed*: e.g. a meeting invite with two time options already
     checked against the calendar.
   - *Needs your attention*: becomes a task with a due date extracted from the
     mail.
   - *Follow up*: "Mark hasn't answered in 5 days. Send a nudge?"
   - *New rule proposal*: "Move Substack newsletters to the digest?"
3. Answer the **quick checks** (yes/no on uncertain automatic decisions).
4. **Done**: "You're clear. Next briefing at 13:00."

### When curious or worried
- **Handled**: everything done automatically today, grouped by outcome, each
  with its reason and Undo, and "Always / Never" to teach.
- **Digest**: low-value mail as one line per item, read when there is time.
  Mute, unsubscribe or promote a sender from there.

### Weekly
- **Delegation** shows accuracy per category and the system's suggestions to
  raise or lower autonomy, plus all rules in plain language, their sources and
  pending AI proposals.

## 5. Screens

| Screen | Purpose |
|---|---|
| **Today** | Briefing, decision stack, quick checks, done state |
| **Handled** | Receipts of automatic actions, undo, teach |
| **Digest** | Low-value mail summarised, sender actions |
| **Tasks** | Mine (from mail, with due dates) and Waiting on others |
| **Delegation** | Autonomy per category, rules, AI proposals, rule sources |
| **Activity** | Runs, counts, tokens and cost, errors |
| **Settings** | Mailbox, dry-run, send limits, quiet hours, AI budget |
| Command bar | Plain-language questions and actions, from any screen |

## 6. Keyboard

| Key | Action |
|---|---|
| `Enter` | Do the recommended action |
| `E` | Edit (draft or task) |
| `S` | Snooze until next briefing |
| `X` | Dismiss / don't do it |
| `Z` | Undo the last action |
| `/` or `Ctrl K` | Command bar |
