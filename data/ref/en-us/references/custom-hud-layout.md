# custom_hud_layout Implementation Notes

> **Field notes, verified on live Workshop Tools.**
> Everything below was confirmed on a real server, with guesses and measurements kept apart.
> The most expensive lesson this round: *never* conclude "it worked" from a single observation —
> so every claim below carries a verification status.
>
> - Verified: 2026-08-26 – 27
> - Build: 1.41.7.7 / rev 10937988
> - Prerequisite: `AllowCustomGameUI 1`
> - Harness: testscripts addon
> - Source: original Japanese field notes (TnmsGameHud verification log), translated.

Using CS2's `custom_hud_layout` entity (unlocked by the 2026-08-25 update) to drive Panorama
HUD panels from the server side.

## Contents

- [What works and what doesn't](#what-works-and-what-doesnt)
- [Animation state lives on the panel instance](#animation-state-lives-on-the-panel-instance)
- [Solution catalog](#solution-catalog)
- [Properties that are safe to animate](#properties-that-are-safe-to-animate)
- [Playing sounds](#playing-sounds)
- [The budget model](#the-budget-model)
- [Design observations](#design-observations)
- [Open questions](#open-questions)

## What works and what doesn't

The layout is static. Only class names and strings travel over the network.
vxml / vcss must already exist on the client. The server has exactly two calls —
`SetHasClass` and `SetDialogVariableString` — so "put any panel anywhere on the HUD"
is impossible in principle. The expressiveness of your API is decided up front.

| Item | Status | Details |
| --- | --- | --- |
| Including stock vcss | Works | `s2r://` can pull in `csgostyles.vcss_c`. The full stratum font set, `fontSize-*`, and `csgo-hud__color-0..12` all become available — no need to build your own font or color system. |
| Click round-trip | Works | Confirmed: Button → `CS_UM_CustomHudClicked` → server → `SetHasClass`. But clicks only fire while input capture is enabled (same flag as cursor mode). |
| Playing sounds | Works | CSS `sound:` / `sound-out:`. No usermessages, no client scripts. See [Playing sounds](#playing-sounds). |
| Three overlay layers | Works | Undefined → global → per-player. Per-player layers only need entries for players that differ; omit the argument to clear back. |
| Tags / attributes | Limited | Only `Panel` / `Label` / `Image` / `Button`. The `style` attribute cannot be written (rejected at compile time). |
| Decorating substrings | Impossible | CSS classes apply per panel. To color just the `12` in `HP: 12/100` you must split it into a separate Label. |
| `calc()` / `var()` / `@media` / flex / grid | Absent | Not in the `libpanorama.so` property registry. That is why the class-ladder technique is not a workaround but the only option. No resolution-based branching either; the only scaling tool is `ui-scale`. |
| Selectors | Limited | `:nth-child` / `:first-child` / `:last-child` and `:hover` work. No `:not()`, no `::before` / `::after`, no attribute selectors. Only three at-rules: `@define` / `@import` / `@keyframes`. |
| String interning | Capped | `panelId` / `className` / `dialogVariableName`: 1024 each per entity. Values themselves don't consume slots. No log is emitted on overflow — silent failure is possible, so watch it with your own counter. |

## Animation state lives on the panel instance

Read this before anything else. Without it you will inevitably hit
"value updates work but the animation breaks."

Animation / transition progress state belongs to the panel instance.
The server can only toggle classes ON/OFF — there is no way to say "reset."
So even if you reuse a panel logically, its previous playback state survives.
This bites immediately in UI that reuses rows, like a notification feed.

### off → on within the same tick never arrives

> Status: confirmed by measurement.

This travels as entity netvar deltas, not usermessages — writing the same field
several times in one tick only sends the diff against the final value.
Turning a class off and back on produces a zero diff, i.e. nothing is sent.
The animation is not reset; it just keeps playing.

```text
Same tick, naive:
SetHasClass(p, "run", false)
SetHasClass(p, "run", true)
→ diff = none — nothing reaches the client

Same tick, ping-pong:
SetHasClass(p, "run-a", false)
SetHasClass(p, "run-b", true)
→ diff = run-b — always delivered, zero wait
```

The class name always changes, so the diff is always non-zero. This is the whole
idea behind ping-pong (below).

### off → wait → on works, but needs ≥ 0.3 s

> Status: mechanism unknown.

Failed at 0.05 s and 0.016 s; only became stable at 0.3 s and above.
At 64 tick, 1 tick = 15.6 ms, so tick granularity does not explain it.
It may simply be coarse resolution on the `Instance.Delay` side — do not take
it as a platform constant. Either way, a 0.3 s blank is visible on a HUD,
so the practical answer is ping-pong.

### Dialog variable writes reset width transitions

> Status: confirmed by measurement.

Writing `SetDialogVariableString` on the same row as a panel running
`transition-property: width` snaps the bar back to full and redraws it.
Update a remaining-seconds label every second and the bar rewinds every second.

Isolated so far:

- It doesn't matter where you write. Happens when writing to the bar's ancestor (the row panel) or a sibling label.
- It doesn't matter where the class lands. Directly on the bar, or on the row with a descendant selector — same result.
- String length is irrelevant. Zero-padding the seconds to fixed digits doesn't help.
- It doesn't happen on paths that don't touch text. Same code without the seconds value drains normally.

Inferred mechanism: "Label text swap → Label remeasure → row re-layout →
`width: 100%` re-resolved → transition re-armed." The root cause is that `width`
resolves against the parent's realized size.

### Stranded classes (a server-side bookkeeping bug)

> Status: confirmed by measurement.

Staged class-swap sequences break when overlapped on the same panel:

```text
A: remove tdur-10 → (wait) → add tdur-10
B: starts mid-flight. Ledger says "nothing applied",
   skips the strip step → adds tdur-6
Result: tdur-10 and tdur-6 both applied.
The ledger only knows tdur-6, so tdur-10 never comes off.
```

It fails silently — nothing in server logs, no client warnings. The only
symptom is "values update fine but the animation looks wrong."

### Ladder classes must out-rank base rules

> Status: confirmed by measurement / stepped on once.

Writing ladders (`.tdur-N` / `.x-N`) as single classes ties their specificity with
base rules like `.clip-bar { transition-duration: 0s; }`, and source order inside
the vcss decides. If the base rule comes after the ladder, the ladder silently
loses. Symptoms — "animation finishes instantly" or "doesn't move at all" —
are indistinguishable from the restart problem.
Rule: always generate ladders with at least two classes (or id + class). If a
generator produces them, bake that rule into the generator.

## Solution catalog

What actually settled the problems above, on live servers.

### Ping-pong classes — the only way to restart

Prepare two classes with identical content and alternate them. The class name
always changes, so the diff is always non-zero, and you can replay within the
same tick. Zero wait. Repeated triggers restart every time, so no server-side
merge guard is needed.

### @keyframes need *two different names*

> Status: confirmed with a two-factor experiment.

Playback triggers when `animation-name` actually changes — swapping classes alone
is not enough. The contents can be byte-identical; only the names must differ.

| Keyframes names | Strip / add | Result |
| --- | --- | --- |
| Same | Same tick | 1st fails, 2nd succeeds (unstable) |
| Different | Same tick | Stable, and playback starts instantly ← adopted |
| Same | Different tick (0.35 s) | Stable, but with a 0.35 s animation-less blank |

Correction history: at one point this document concluded "same name is fine."
The observation behind that actually showed "1st fails, 2nd succeeds" — the
read of the second success as "it worked" was wrong, overturned by the
two-factor experiment. Lesson repeated: never call something "working" off one
observation.

### Build gauges and bars with clip

Valve's own property documentation says it outright —
"This clipping has no impact on layout, and is fast and supported for
transitions/animations."
Because it doesn't touch layout, a bar won't rewind even when text on the same
row updates every second. Confirmed solved by measurement.
Whether a property's description carries that sentence is a usable safety test.

### @keyframes cannot animate width

> Status: confirmed on re-verification.

Re-measured with a ping-pong form that reliably re-arms playback — width still
did not move at all. Ping-pong itself was verified working on a ring, so
"playback isn't restarting" is excluded as a cause. Clip and wash-color move;
width doesn't — that's the paint-vs-layout boundary.

### Serialize write sequences with generation numbers

An implementation remembering "the last value written" in one variable gets
stomped by concurrent writers and strands state. Give each row a generation
number and re-check ownership after every await; a displaced call stops writing
entirely:

```csharp
const int gen = ++rowGen[i];
// ... writes ...
await Instance.Delay(life);
if (rowGen[i] != gen) return; // lost the row — stand down quietly
l.SetHasClass(row, "hidden", true);
```

This also closes the accident where a stale call wakes from its delay and hides
the row a newer call just showed. Don't expose async sequences to consumers —
public APIs return immediately; serialization happens inside.

### Split axes with nested position panels

| Axis | margin % | position % |
| --- | --- | --- |
| Horizontal (X) | Correct | Correct |
| Vertical (Y) | Resolved against the parent's *width* (same semantics as web CSS). Skews wholesale in non-square frames | Correct |
| transition | Doesn't work | Works |

`position` is one property taking x y z, so the axes can't be separated within it.
Nest instead: outer panel = vertical band (owns X, needs `height: 100%`) /
inner panel = the box itself (owns Y). Cost: 2 panelIds per moving element.
Pitfall: `position: 100%` means "panel's left edge at parent's right edge" —
the panel's own size is not subtracted. The practical ceiling is
`100 − (own size ÷ parent size × 100)`. Have the API accept 0–100 and map to
the practical range internally.

## Properties that are safe to animate

Classify by "does it break when text updates in the same subtree?"

| Property | Affected by text updates? | Basis |
| --- | --- | --- |
| `clip` | No | Measured + Valve's description |
| `position` | No | Measured (4 writes mid-move, still smooth) |
| `width` | Yes | Measured |
| `opacity` / `wash-color` / `background-color` / `brightness` / `transform` | Not measured (presumed safe) | — |
| `height` / `margin-*` / `padding` | Not measured (presumed risky) | — |

Beware of over-generalizing. That `position` turned out safe was unexpected —
"all layout properties are dangerous" is simply false. What actually breaks
seems to be properties whose resolved size depends on the parent; `position`
uses the given value as-is, which is consistent. The mechanism is unconfirmed:
always measure before animating a new property.
Design-wise, restrict animation targets to paint-time-closed properties, and
enforce it in the registry — that stops consumers from quietly breaking things
by animating `width`.

## Playing sounds

CSS `sound:` / `sound-out:` is all you need. No usermessages, no client scripts.

### Server SetHasClass triggers sounds

> Status: confirmed by measurement.

`sound` fires when the selector becomes applied; `sound-out` fires when it is
removed. Both worked.

### Take sound names from current CS2 vcss

First tried GO-era names (`UIPanorama.popup_reveal` etc.) — silence. On checking,
none of those four exist anywhere in CS2's vcss. The cause of "no sound" was a
plain naming mismatch, not unsupported functionality — that nearly produced a
wrong conclusion in these notes. Harvest real names like this:

```bash
grep -r -h -n -o 'sound[-out]*:\s*"[^"]*"' ref/panorama/styles/ \
  | sed 's/.*"\(.*\)"/\1/' | sort -u
```

Three families of names exist, and all three played from custom_hud. No
"menu sounds don't reach in-game" restriction was observed.

| Family | Examples | Origin |
| --- | --- | --- |
| `UI.*` | `UI.DeathMatchBonusKill` / `UI.CounterBeep` / `UI.Mission.Complete` | Under `styles/hud/` — used by the in-game HUD |
| `UIPanorama.*` | `UIPanorama.generic_button_press` / `checkbox_toggle` | Main menu side |
| No prefix | `generic_button_press` / `ui_select_arrow` | Same |

### Repeated playback needs ping-pong — but the sound name may stay the same

> Status: confirmed by measurement.

off → on of a single class produces no sound: the diff collapses and the
"selector just became applied" moment never occurs — the exact same root cause
as the restart problem, with "no sound" as its disguise. Unlike `@keyframes`,
the content (sound name) may stay identical; the behaviors diverge here.

### The rapid-fire limit is per sound event

> Status: settled by four-way isolation.

Repeating the same event at short intervals stops playing after about 3 hits.
Even 1 s intervals failed, so it isn't tick granularity.

| Suspect | How it was isolated | Verdict |
| --- | --- | --- |
| Class not delivered | Attached a background color to the ping-pong classes so color flips with the sound | Innocent — color flipped every time, even silent rounds |
| No refire unless the value changes | Compared against a variant with different sound names on -a / -b | Innocent — still dropped with names changed |
| Sound too long, re-requests discarded | Hammered with extremely short UI click sounds | Innocent — short sounds drop too |
| Per-event cap | Rotated 4 short sounds so consecutive triggers are always different events | Guilty — 12 in a row all played |

Design rule: anything that can fire at high rate should rotate 3–4 sounds.
Notifications that differentiate by severity naturally rotate, since consecutive
notifications tend toward different severities.

### Stack sounds at zero budget

No need to add dedicated sound classes — piggyback on classes already
ping-ponging. Elements with entrance animations usually want a sound at the
same moment anyway, so this fits well:

```css
/* .tin-a / .tin-b always alternate whenever a toast appears.
   Layering severity on top gives "severity-specific sound per appearance".
   Dedicated sound classes would consume 8 slots; this consumes 0. */
.toast-stack.snd-on .toast.sev-err.tin-a { sound: "UI.DeathMatchBonusKill"; }
.toast-stack.snd-on .toast.sev-err.tin-b { sound: "UI.DeathMatchBonusKill"; }
```

Note: some existing event names still don't play (or aren't audible). Of four
rotated, one produced no audible sound. A name existing in documentation and
it being audible in this context are different things — always audition sounds
on a live server before adopting.

## The budget model

`panelId` / `className` / `dialogVariableName`: 1024 each per entity.
Only the roots of independently-controlled groups need ids. Dialog variables
are inherited by descendants and classes reach them through descendant
selectors, so Labels and bars inside a group need no ids. The panelId budget
therefore corresponds to "number of independently controlled groups," not
"number of on-screen elements."

| Thing | panelId | className | Notes |
| --- | --- | --- | --- |
| Scoreboard, 8 columns × 64 rows | 64 | — | Variable names: 8 (independent of row count) |
| One notification row | 1–2 | — | 1 suffices if the bar is driven from the row's class via descendant selector |
| One moving element | 2 | 42 | A panel per axis. Ladder is 5% steps × 2 axes, shared by all elements, so it doesn't grow |
| Panels needing restart | — | 2 | The ping-pong pair. @keyframes are static in vcss and consume no slots |
| Sounds | — | 0 | When piggybacked on existing ping-pong |
| Decorative panels | 0 | — | Consume no slots if given no id |

- Registration happens at startup; no dynamic addition at runtime.
- Express per-player differences as values, not names. Dynamic name generation like `player_42_name` is forbidden.
- Reuse generic variable names (`value` etc.) across panels; don't split per panel.
- If slots run out, split the entity (tables are per-entity). Input capture is refcounted, so multiple entities don't break it.
- The server cannot control string length — always put `text-overflow: shrink min(10px) ellipsis` on fixed-width slots.

## Design observations

From moving the verification harness onto a HUD overlay and comparing at the
positions things actually appear. Premise: judging looks inside a debug window
is always wrong. Build a full-screen overlay, place notifications top-right and
major text top-center — where they will really live — and compare there.

### Notification cards

Compared flat (text + shadow only) against a dark translucent card on live
servers: the card reads better. Then compared plain / 1px hairline border /
stronger drop shadow — both decorated versions beat the plain one. The card's
weakness is losing its outline against dark scenes; hairline and shadow both
patch exactly that. Flat's weakness is becoming unreadable against bright
walls. Judge either in both bright and dark spots.

### Components

| Part | Placement | Construction |
| --- | --- | --- |
| Notifications | Top-right, 5 reused rows | Accent line + icon + title/body + clip-based remaining-time bar. Entrance slides in from the right (ping-pong restarts it every time) |
| Major text | Top-center | Kicker / large title / sub. Three styles: plain shadow / band gradient / warning frame |
| Objective timer | Slightly above center | Mono remaining time updated every second + clip bar — the exact production shape of text updates cohabiting with a gauge |
| Status badges | Bottom-left | Small pills; frame color varies by severity |
| Vote | Bottom-center | Vote bars laid behind rows (`ignore-parent-flow`). One panelId per row |

### The cost structure of iteration

vxml / vcss hot-reload on file save; .js needs compile + map reload. So front-load
the plugin: bake a generic driver (attach class to any panel / write variable /
ping-pong / ladder) once, and afterwards design tuning loops through CSS saves
alone. In practice, color, spacing, typography, and sound-candidate swaps all
happened with no reloads.

## Open questions

Things not yet understood, left as unknown.

1. **Why off → on restarts needed ≥ 0.3 s.** 1 tick = 15.6 ms doesn't explain it; possibly just `Instance.Delay` resolution. Ping-pong sidesteps it in practice, but the floor of "how closely spaced server writes actually reach the client" is worth knowing.
2. **x / y / z are registered as standalone properties besides position.** No descriptions. If they accept % and transition, the axis-nesting becomes unnecessary and moving elements drop from 2 panelIds to 1.
3. **Runtime entity creation.** Keyvalue names are settled by the layout (csgo.fgd). Unknown: the path string format (`.vxml` vs `.vxml_c`, panorama/ prefix or not) and whether `CreateEntityByName` works.
4. **Per-player state propagation to spectators / GOTV.** Per-player state reaches spectators and GOTV, not just the owner. If `m_bInputCaptureEnabled` propagates, spectators' mice get captured. Exclude admin-only info at design time.
5. **Residue when a reconnect reuses a slot.** The previous occupant's per-player state survives. Residual `m_bInputCaptureEnabled` freezes a fresh joiner straight into cursor mode.
6. **Entity survival across round restart / map change.** If destroyed, the intern tables go too — state management must invalidate its whole diff cache whenever the entity handle changes.

---

Field-verified: 2026-08-26 – 27 / CS2 build 1.41.7.7.
Valve marks the entire API `@experimental` (breaking changes possible) — budget for keeping up.
