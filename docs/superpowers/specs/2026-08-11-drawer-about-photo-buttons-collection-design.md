# Mobile drawer, About photo, and a Buttons collection

**Date:** 2026-08-11
**Store:** `xfqqh0-a2.myshopify.com` — Sarah-Beth's Creative Co.
**Status:** shipped 2026-08-11 to live theme `#188773826856`
**Collection created:** `gid://shopify/Collection/514243985704` (`/collections/buttons`)

Three independent pieces of work, gathered here because they were decided in one
session. They touch different files and can ship in any order.

---

## 0. Prerequisite — resync the local theme

**This blocks everything else and must happen first.**

The photo on the About page was added through the Shopify theme editor, which
writes to the live theme only. The local repo has never seen it:

| | `templates/page.about.json` |
|---|---|
| Live theme (`#188773826856`) | `"image": "shopify://shop_images/516535418_…_n.jpg"` |
| Local repo | setting absent |

Pushing the local theme in its current state would delete the photo. So:

```bash
export PATH="/home/jo/.nvm/versions/node/v22.23.2/bin:$PATH"
shopify theme pull --store xfqqh0-a2.myshopify.com --theme 188773826856
```

Commit the result on its own, with no hand edits mixed in, so the theme-editor
changes stay separable from ours in the history. Review the diff before
committing — a pull may drag down other editor changes we don't know about.

Also add a `.gitignore` (the repo has none) covering `.superpowers/`, which the
brainstorming companion wrote into the working tree.

---

## 1. Mobile drawer — "Paper & Pin"

The drawer works correctly today (Escape closes it, focus returns to the
hamburger, the nav tree is shared with desktop so the two can't drift). It just
doesn't look like it belongs to this site. Three causes, confirmed with the
user: the logo turns into text, the panel is narrow, and it carries none of the
palette.

### `snippets/site-logo.liquid` — new

The logo block is currently inline at `sections/header.liquid:13-18`. The drawer
needs the identical mark. `snippets/nav-tree.liquid` already establishes the
house position on this — *"two copies of this loop is how the two navs drift
apart"* — so extract rather than duplicate.

Accepts `logo` and `logo_width` so the theme editor still drives both call
sites, and keeps the existing `logo.png` fallback.

### `sections/header.liquid`

- Drawer header renders `site-logo` in place of
  `<span class="site-header__logo">{{ shop.name }}</span>` (line 66), capped at
  the same 38px the mobile header uses so the brand doesn't resize when the
  drawer opens. Links to home.
- Remove the `btn--outline btn--sm` "My Account" button (lines 76-78).
- Add a footer row: **Search** and **My Account** as muted text links above a
  hairline rule. Keep the existing `shop.customer_accounts_enabled` guard on the
  account link.

On that last point: the account link is *not* redundant with the header icon.
While the drawer is open those icons sit behind the scrim and can't be tapped.
The defect was that it was styled as a button inside a list of type.

### `assets/theme.css`

| Selector | Change | Why |
|---|---|---|
| `.mobile-nav__panel` | `background: var(--color-bg)` (paper `#FBF7EF`) instead of `var(--color-surface)` (white) | The change that stops it reading as borrowed — the whole site is cream |
| `.mobile-nav__panel` | width `min(340px, 88vw)`, was `min(300px, 88vw)` | Addresses "cramped" |
| `.mobile-nav__panel` | add `box-shadow: var(--shadow-lg)` | Matches the cart drawer (`theme.css:1208`); the nav drawer has no shadow at all |
| `.mobile-nav__links .nav-tree__item:last-child .nav-tree__row` | `border-bottom: none` | A rule currently dangles under the last link with nothing beneath it |
| `.nav-tree__link[aria-current="page"]` | 7px `--color-primary` dot at the row's right edge | The orange accent, on the one element that earns it |
| new | drawer footer row styles | |

**Contrast constraint — do not break this.** The dot is a *fill*, so it uses the
true orange `--color-primary`. Any orange that is *text* must keep using
`--color-accent-ink`, the darkened cut. `theme.css:39-41` documents why: Auburn
orange measures 2.77:1 as small text on paper and fails WCAG AA.

### `assets/theme.js`

Add a focus trap to the open drawer. Tab past the last link currently walks into
the page behind the scrim. **Do not touch** the existing Escape handler or the
focus-return logic — both already work.

### Explicitly not changing

The slide easing, and the `visibility`-based hide. The comment at
`theme.css:584-589` records a real bug that approach fixed; reopening it is not
in scope.

---

## 2. About page photo — "set into the writing"

### The defect

`theme.css:1985` hard-codes `grid-template-columns: 300px minmax(0, 1fr)` with
`align-items: start`. The About page runs ~2,600 characters across four headed
sections, so the photo renders at exactly 300px, pinned top-left, with roughly
700px of text beside it and the lower two-thirds of its column empty.

### The second defect

`sections/main-page.liquid` sets `sizes: '(min-width: 900px) 300px, 100vw'`.
Shopify uses `sizes` to choose which rendition to serve, so desktop only ever
receives a 300px-wide file. **Widening the CSS without fixing `sizes` produces a
bigger but blurry photo.** These two changes must ship together.

### The fix

Drop the two-column grid. The figure floats inside a single 860px measure and
the prose wraps around it, then reflows to full width below.

```
.page-content--portrait   max-width: 860px; display: block
                          ::after { content:''; display:block; clear:both }
.page-portrait            float: left; width: 360px; margin: 0.25rem 2rem 1.25rem 0
@media (max-width: 767px) float: none; width: 100%; max-width: 420px;
                          margin: 0 0 1.5rem
```

The clearfix matters: on a short page (Contact uses this same section) the prose
can end above the photo, and without it the next section would overlap.

`main-page.liquid` — `sizes: '(min-width: 768px) 360px, 100vw'`. The existing
`widths: '300,450,600,800'` then covers a 360px slot at 2× DPR.

**Why this one:** it self-corrects for any image aspect ratio. That mattered
because the image's dimensions are still unknown — reading them needs the
`read_files` scope, which the current store auth lacks. The masthead option was
rejected for exactly this reason: it crops hard and would cut off heads on a
vertical portrait.

---

## 3. Buttons collection

Automated collection, so it never needs maintaining.

| Field | Value |
|---|---|
| Title / handle | Buttons / `buttons` |
| Rule column | `PRODUCT_CATEGORY_ID_WITH_DESCENDANTS` |
| Relation | `EQUALS` |
| Condition | `gid://shopify/TaxonomyCategory/aa-2-24` — Pinback Buttons |
| `appliedDisjunctively` | `false` |
| `sortOrder` | `MANUAL` |
| In navigation | No |

Every enum above was introspected against this store's schema, not recalled.

**Why category, not tags or product type.** All six products have empty
`productType` and zero tags — either would mean backfilling now and remembering
forever. The taxonomy category is already correct on all six, and Shopify
auto-suggests it in the product form, so a new button joins the collection with
no action. It also survives renames: "Tri-Delta Tiger Button" was clearly
renamed at some point (its handle is still `tri-delta-aubie-pin`), and a
title-based rule would have silently dropped it.

`WITH_DESCENDANTS` rather than the plain match: identical today, since Pinback
Buttons is a leaf node, but it keeps working if Shopify ever subdivides that
node.

`MANUAL` sort so Sarah-Beth can feature what she likes. Best-selling is
meaningless on a shop that has never sold.

**Accepted limitation.** This collection holds 100% of the catalog today, which
makes it redundant with "All products". The user is building it deliberately
ahead of need, so that it is already correct on the day non-button products
appear. Not in the nav for the same reason.

Executed via `shopify store execute --allow-mutations` with `collectionCreate`.
Requires `write_products` scope.

---

## Verification

| Track | Check |
|---|---|
| Drawer | Open on a real phone viewport at 375px and 768px: logo is the image, panel is paper not white, no rule under the last link, orange dot on the current page, Tab cycles inside the drawer, Escape still closes, focus returns to the hamburger |
| About | Desktop ≥900px: text wraps the photo, no dead column. Mobile: photo stacks full width. Inspect the served `src` — confirm it is not a 300px rendition. Load Contact (no image) and confirm the layout is unaffected |
| Collection | Re-query the collection and confirm all 6 products are members and `ruleSet` matches the table above |

## Out of scope

Desktop navigation, the cart drawer, the announcement bar, and any change to
product data. No new brand assets — logos and marks come from Sarah-Beth, not
from us.
