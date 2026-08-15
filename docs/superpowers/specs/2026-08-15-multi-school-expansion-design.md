# Multi-school expansion — design

## Goal

Requests for schools beyond Auburn are coming in regularly. Auburn stays the
shop's home base — homepage, hero, main nav, and the personal "War Eagle
y'all" story are untouched. Other schools get their own well-treated space
that feels dedicated to them, not a generic multi-school catalog with a
filter checkbox. Arkansas is the first school; the pattern needs to hold up
for a second and third without a redesign each time.

## Data model

Each school is a **Collection**, exactly like Football/Sorority today —
products get tagged and added the same way, no new product structure.

A school's identity (colors, welcome copy, maybe a photo) lives on
**Collection metafields**, not hardcoded in Liquid:

- `custom.school_primary_color` (color)
- `custom.school_accent_color` (color)
- `custom.school_welcome` (rich text) — the specific, researched intro copy
- `custom.school_name` (single line text) — display name if different from
  the collection title (e.g. title "Arkansas", display "Arkansas Razorbacks")

This means adding a fourth school later is an **admin-only task**: create a
collection, set four metafields, tag products in. No theme file changes.
That's most of the way to the "repeatable system" without committing to
building a full admin UI for it now.

URL: `/collections/arkansas` — Shopify's native collection path. No custom
`/schools/` prefix; that would need an app and isn't worth it here.

## Theming mechanism

Auburn's navy/orange are root-level CSS custom properties in
`assets/theme.css`, applied site-wide by default. For a school collection
page, the collection template sets inline custom-property overrides on a
wrapper element, sourced from that collection's metafields:

```liquid
<div class="school-page" style="--color-primary: {{ collection.metafields.custom.school_primary_color }}; --color-accent: {{ collection.metafields.custom.school_accent_color }};">
```

Everything inside that wrapper — buttons, badges, the filter panel, product
cards — inherits the override automatically, since they already reference
`var(--color-primary)` etc. rather than hardcoded Auburn hex values. No
component needs to know it's rendering for a different school.

## Navigation & discovery

- A new **"Find Your School" page** (built the same way as Request a
  Design — its own page template) lists each school as a card: name, a
  small color swatch, link to their collection. This is what lets a third
  and fourth school get added without touching nav again.
- One nav entry to that page, in the **footer** rather than main nav —
  keeps Auburn's primary nav (currently 5 items) uncluttered.
- A single low-key line added to the existing `shop-features` section on
  the homepage (the "Small shop, my own two hands" band) — a fifth small
  line/link, "Shop for another school →", rather than a new section. Keeps
  it present without giving it hero-level visual weight next to Auburn's
  own CTAs.
- Each school's collection page links back to "Find Your School," so a
  visitor landing on Arkansas's page via a shared link can see it's a real,
  current section of a bigger shop, not a dead end.

## Legal

The Terms of Service currently name Auburn and Tri-Delta specifically
("not affiliated with, endorsed by, sponsored by, or officially licensed by
Auburn University, Delta Delta Delta..."). This needs to generalize to a
clause covering any school referenced in the shop, rather than an
enumerated list that has to be edited every time a school is added. Draft
language, for Sarah-Beth to actually read and approve before it goes live
(legal-facing content, not a rubber-stamp edit):

> Sarah-Beth's Creative Co. is an independent shop selling original,
> hand-drawn fan art. We are not affiliated with, endorsed by, sponsored
> by, or officially licensed by any university, athletic program, or Greek
> organization referenced in this shop. Any references to team names,
> mascots, colors, or traditions are used descriptively, in the spirit of
> fan celebration, not as a claim of official partnership.

## Content strategy

Homepage and About page are untouched — that's Sarah-Beth's real,
personal Auburn story, and it doesn't transfer to a school she has no
connection to.

Each school's collection intro is a **rich-text metafield** (same editing
mechanism as the About/FAQ page bodies), not fixed template fields — so the
length and structure can flex per school rather than forcing every school
into the same shape. Sarah-Beth writes the actual final copy herself, in
her own voice; this research is raw material for that, not copy to paste
in verbatim.

The instruction was specific: reference shared experience and terminology
that current and recent students actually recognize, not tourist-brochure
facts. That distinction matters — official-site material (colors, mascot
name) reads as generic; the things that make someone feel *seen* are more
specific and more current.

## Arkansas research

**Sources:** [Arkansas Razorbacks Traditions](https://arkansasrazorbacks.com/traditions/), [Calling the Hogs (Wikipedia)](https://en.wikipedia.org/wiki/Calling_the_Hogs), [How the Hog Call Originated (Arkansas Alumni Association)](https://blog.arkansasalumni.org/how-the-hog-call-originated/), [Arkansas Traditions (uark.edu)](https://www.uark.edu/about/traditions.php), [Fayettenam definition/discussion](https://www.urbandictionary.com/define.php?page=2&term=Fayettenam), [Does Fayetteville need a nickname? (Fayetteville Flyer)](https://fayettevilleflyer.com/2009/11/09/does-fayetteville-really-need-a-nickname/), [Bid Day 2025 (Arkansas News)](https://news.uark.edu/articles/79841/greek-life-at-the-u-of-a-to-celebrate-panhellenic-bid-day-2025), [Panhellenic Council (uagreeks.uark.edu)](https://uagreeks.uark.edu/panhellenic-council/), [Battle Line Rivalry (Wikipedia)](https://en.wikipedia.org/wiki/Battle_Line_Rivalry), [Tailgater Guide: University of Arkansas](https://www.tailgaterconcierge.com/tailgater-guide-university-of-arkansas/), [Arkansas Razorbacks Color Codes](https://teamcolorcodes.com/arkansas-razorbacks-color-codes/)

**Colors:** Cardinal `#9D2235`, White `#FFFFFF` (PMS 201).

**The hog call, specifically.** "Woo Pig Sooie" isn't just a chant, it has
a real, physical, communally-known choreography: the "Woo" starts low and
builds over roughly eight seconds while both arms raise with fingers
wiggling; arms drop and fists clench on "Pig"; "Sooie" lands with a fist
pump; after the third call, "Razorbacks" gets two more fist pumps. Everyone
who's stood in that student section knows this in their body, not just as
words. That physicality is more specific and more usable than just quoting
the phrase.

**Tusk** — the live mascot, a Russian boar, at every home game. Currently
Tusk V.

**Old Main** — the university's oldest building (1875), its twin towers
are literally in the school's official logo. Visible from much of campus.

**Senior Walk** — sidewalks across campus engraved with the names of over
230,000 graduates going back to 1876. Longest-running tradition on campus
by most measures. A current or recent student has almost certainly walked
over their own future name, or looked for a parent's or grandparent's.

**The Hill** — a real, affectionate nickname for the university/Fayetteville.
Safe to use.

**"Fayettenam"** — also a real nickname in circulation, but contested; it
originated as a Fayetteville, NC term tied to Vietnam and not everyone is
comfortable with the association carrying over. Flagging this so it's a
deliberate skip, not an oversight — I'd avoid it in shop copy even though
it will register with some students.

**"Track Capital of the World"** — a genuinely earned nickname, not
marketing puffery; Arkansas's track & field/cross country programs are
historically dominant. Worth knowing even for a football-first shop,
since it's a point of real campus pride.

**Dickson Street** — the entertainment district just off campus and
downtown; bars, live music, the actual social gravity of a Fayetteville
Saturday night, not just gameday.

**The Hog Walk** — before every home game, the team and coaches walk in
from the Access A area to the stadium, joined by the band and spirit
squad, high-fiving fans lining the route. This is the pregame ritual
equivalent of Auburn's Tiger Walk — worth designing toward directly, it's
the moment fans plan their arrival time around.

**Bid Day specifics** — new members receive their bid at the **Greek
Theatre**, then run to their new chapter house, where they get a jersey
with their letters pulled on over their clothes. Celebrations continue
along **Maple Street** in front of the chapter houses. Both "Greek
Theatre" and "Maple Street" are real, specific place-names a Panhellenic
audience will recognize immediately — much stronger than generic "Bid Day"
copy.

**Panhellenic chapters** — confirmed complete via the official Panhellenic
Council page, all 12: Alpha Chi Omega, Alpha Delta Pi, Alpha Omicron Pi,
Alpha Phi, Chi Omega, Delta Delta Delta, Delta Gamma, Kappa Delta, Kappa
Kappa Gamma, Phi Mu, Pi Beta Phi, Zeta Tau Alpha.

**Bid Day, confirmed further** — the official name is the **Chi Omega
Greek Theatre**. Maple Street is fully shut down for the run, not just
crowded — new members run from the Greek Theatre to their chapter house
while it's closed to traffic, described in coverage as new sisters
getting to "run home."

**Rivalries** — the "Battle Line Rivalry" against Missouri (late
November, a real circled-calendar date) and the historic "Battle for the
Golden Boot" against LSU (the annual finale before 2014, still referenced
by longtime fans even though it's not played every year now).

**Stadium Drive** — the tailgating corridor outside Donald W. Reynolds
Razorback Stadium; "tailgates rolling along Stadium Drive" is how it's
actually described by people who go.

## Arkansas welcome copy (draft)

Split into two metafields rather than one — `custom.school_heading`
(plain text, for the large display heading, matching the homepage hero's
"Take a little Auburn with you" treatment) and `custom.school_welcome`
(rich text, the body below it). One field couldn't carry both a big
display heading and flowing body copy at the right visual weights.

**`school_heading`:**

> Take a Little Arkansas With You

**`school_welcome`:**

> Woo Pig Sooie!
>
> Everything in this shop is drawn by hand and made to order — one
> design at a time, whichever school it's for. Nothing here comes
> pre-made off a shelf.
>
> For Arkansas, that means buttons made for the Hog Call — arms up,
> fists ready by "Sooie." For running down Maple Street on Bid Day with
> your letters pulled on for the first time. For the walk down to the
> stadium before kickoff, high-fiving the team as they head in. I didn't
> go to school on The Hill, so I won't pretend I have my own Old Main
> story — but I'll draw the one you're living now.
>
> New designs go up all season. If there's a chapter, a chant, or a
> Saturday tradition you want to see, tell me, and it goes on the list.
>
> Woo Pig Sooie!
> — Sarah-Beth

This is a full draft, ready to use as-is or edit — not raw material
requiring a rewrite. It deliberately doesn't invent a personal
connection to Arkansas (the honesty about that is the point, not a
hedge), leans on the specific researched details rather than generic
"go Hogs" copy, and closes the way the Auburn pages close on "War
Eagle" — with the real, complete call, not a shortened version that
might not land right with someone who actually knows it.

## Implementation sketch

On the `arkansas` branch:

1. New section `sections/school-collection-hero.liquid` — reads the
   collection's metafields (`school_heading`, `school_welcome`,
   `school_primary_color`, `school_accent_color`), renders the heading +
   rich-text welcome, colors applied via the CSS custom-property wrapper
   described above.
2. New template `templates/collection.arkansas.json` — `school-collection-hero`
   section on top, existing `main-collection` section below (unchanged,
   already has filtering/sort/category pills).
3. New page template + section for **Find Your School**
   (`templates/page.find-your-school.json` +
   `sections/main-find-your-school.liquid`), same pattern as Request a
   Design — lists school collections as cards, reading each one's
   metafields for name/color swatch.
4. Footer nav: add "Find Your School" entry (via Admin GraphQL menu
   update, same mechanism used for Request a Design).
5. Homepage: add a "Shop for another school" link to the existing
   `shop-features` section (`sections/shop-features.liquid`), not a new
   section.
6. Arkansas collection created via Admin API: metafields set with the
   Cardinal `#9D2235` / white palette and the heading/welcome copy above.
7. Terms of Service: generalized disclaimer language (drafted earlier in
   this doc) replaces the current Auburn/Tri-Delta-specific paragraph.

## Status

Fully drafted — colors, all 12 chapters, welcome copy, and the ToS
language are resolved, not open questions. Ready to move to an
implementation plan and build.
