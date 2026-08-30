# Panorama CSS Quick Reference

> **What can and cannot be written in a Panorama stylesheet.**
> The property registry comes from `libpanorama.so` registrations; behavior comes
> from live CS2 servers and stock vcss files. Web names are included, so searching
> for `flex` or `backdrop-filter` finds where they land.
>
> - 140 properties registered; 98 carry a description, 42 do not (per the recovered registry)
> - Hard limit: 255 (the property factory index is one byte)
> - Sources: `libpanorama.so` / stock vcss / live verification
> - Statuses: usable / trap / absent / unverified
> - Source: original Japanese quick-reference (TnmsGameHud), translated.
>
> **Snapshot note:** the original artifact's interactive property table (section 02)
> and the raw 140-name appendix (section 06) were client-filtered views whose rows
> did not survive the page snapshot. The registry itself has since been recovered
> verbatim from `libpanorama.so` — see the companion doc
> [Panorama CSS Property Registry](panorama-css-properties.md) for all 140 entries
> with Valve's own doc strings.

## 01 — Four facts that change your design

These matter before any individual property. Bring web CSS over without knowing
them and you don't rewrite code — you redesign.

### No flex / grid

Layout is unidirectional flow via `flow-children` only. No `justify-content`, no
`gap`: alignment is built with wrapper panels, spacing with the children's margins.

### No var() / calc()

Tokens must be baked to concrete values at build time. Continuous values cannot be
computed in CSS, which is why the class-ladder approach (`pv-0` … `pv-100`) is not
a workaround but the only option.

### No @media

No resolution-based branching. The only scaling tool is `ui-scale` (scales at the
layout stage; font sizes follow).

### Registered ≠ usable

`background-blur` carries a full description yet does nothing. Zero usage in
Valve's own vcss. First-hand information means: check whether stock vcss actually
uses a property.

## 02 — Properties: usable, traps, absent

Statuses: *measured* = confirmed on a live CS2 server; *trap* = registered but
does nothing; *unverified* = registration exists but behavior in custom_hud was
never observed. Families that only expand mechanically (`border-*` / `padding-*`
etc.) were collapsed to one row in the original, but individual names remained
searchable.

> The original's filterable per-property table did not survive the page save, but
> the full registry has been recovered from `libpanorama.so` — every property with
> its description and examples is in
> [Panorama CSS Property Registry](panorama-css-properties.md). The design-level
> facts in section 01 and everything below are complete.

## 03 — Selectors and at-rules

Selector-side constraints stop ports more often than properties do.

### Selectors that work

| Form | Notes |
| --- | --- |
| `.class` `#id` `PanelType` | The basics. PanelType is `Label` / `Panel` etc. |
| Descendant (space) | The most used |
| `>` child combinator | Works. Not in the binary-derived lists, but stock vcss uses it in 35 places |
| Nestling and `&` | `&.Dismissed` / `&:hover` |
| `:hover` `:active` `:focus` `:disabled` `:selected` `:root` `:descendantfocus` `:activationdisabled` | The full pseudo-class set |
| `:nth-child` `:first-child` `:last-child` | No need to attach per-row classes in repeated structures |

### Selectors that don't exist

| Missing | What to do instead |
| --- | --- |
| `::before` / `::after` | Put real decorative panels in the vxml |
| `:not()` | "No margin on the last item only" → `:last-child`. Everything else: split classes and accept it |
| Sibling combinators `+` `~` | Zero usage even in stock vcss |
| Attribute selectors `[attr]` | Express with classes |
| `:nth-of-type` | Substitute `:nth-child` |

### Only three at-rules

| At-rule | Use |
| --- | --- |
| `@define` | Value aliasing. `@define hudWorldBlur: gaussian(2,2,2);` |
| `@import` | Pull in stock vcss. `s2r://panorama/styles/csgostyles.vcss_c` |
| `@keyframes` | Written statically, consumes no intern slots |

Anything else is rejected with `Found unsupported CSS at-rule` — including `@media`.

## 04 — Value vocabulary

| Kind | Syntax |
| --- | --- |
| Colors | `#rrggbb` / `#rrggbbaa`. No `rgb()` / `hsl()` (transparent is `#00000000`) |
| Gradients | 2008-era WebKit form. `gradient( linear, 0% 0%, 0% 100%, from( #fff ), color-stop( 0.3, #eee ), to( #ccc ) )` |
| Easing | `ease` `ease-in` `ease-out` `ease-in-out` `linear` `cubic-bezier` |
| transform | `translate/3d/X/Y/Z` `rotate/3d/X/Y/Z` `scale/3d/X/Y/Z` `skew/X/Y` |
| Blend modes | `additive` `multiply` `screen` `overlay` `darken` `lighten` `colorburn` `colordodge` `hardlight` `softlight` `hue` `normal` |
| Lengths | `px` / `%`. No `vh` `vw` `ch` `rem` |
| Size keywords | `fit-children` / `fill-parent-flow(w)` / `width-percentage(p)` / `height-percentage(p)` |

## 05 — Conversion table: porting from web CSS

Things you can swap in directly. More features exist under different names than
you'd expect.

| Web | Panorama | Notes |
| --- | --- | --- |
| `hsl()` / `oklch()` / `rgba()` | `#rrggbbaa` | Bake to hex at build time |
| `0.5rem` | `8px` | Precompute at root 16px |
| `backdrop-filter: blur()` | `world-blur: gaussian( 2, 2, 2 )` | Not `background-blur`. Only the world / backbuffer blurs; other panels don't |
| `filter: blur()` | `blur: gaussian( 2.5 )` | Blurs itself and its children |
| `box-shadow: 0 1px 2px rgba(0,0,0,.1)` | `box-shadow: fill #0000001a 0px 1px 2px 0px` | Order is `[shape] color h v blur spread`; shape is `inset` / `fill` / `hollow` |
| `text-shadow` | `text-shadow: 0px 1px 4px 1.0 #000000cc` | `h v blur strength color` — strength exists |
| `mix-blend-mode` | `-s2-mix-blend-mode` | Exists, prefixed |
| `width: fit-content` | `width: fit-children` | |
| `aspect-ratio` | `width: height-percentage( 100 )` | The reverse direction also works |
| `pointer-events: none` | `hittest="false"` in vxml | An attribute, not CSS |
| `text-overflow: ellipsis` | `text-overflow: shrink min( 10px ) ellipsis` | The server can't control string length — always specify |
| `display: none` | `visibility: collapse` | Leaves the flow; toggling with `visible` recalculates layout |
| `gap` | `margin-right` on children + cancel with `:last-child` | Without `:not()`, this is the only form |
| `justify-content` | Non-flow parent + `width: fit-children` + `horizontal-align` wrapper | Remember it as "aligning a row = make a wrapper" |

## 06 — Beyond CSS: custom_hud-only limits

Passing CSS is not passing vxml. custom_hud layouts run under a stricter
whitelist than regular Panorama.

| Item | Details |
| --- | --- |
| Usable tags | Only the four: `Panel` / `Label` / `Image` / `Button` |
| Usable attributes | `Panel{id,class,hittest}` / `Label{id,class,hittest,text}` / `Image{id,class,hittest,src}` / `Button{id,class}` |
| `style` attribute | Cannot be written (compile error). Inline styles do not exist |
| `html` attribute | Cannot be written → substring decoration is impossible. Split the Label to color just the `12` in `HP: 12/100` |
| Outermost panel | Cannot be given an id → the root's class can't be touched from the server = all z-index values are static |
| Name caps | `panelId` / `className` / `dialogVariableName`: 1024 each per entity. Only names the server references count; classes written statically in vcss consume no slots at all |

The whitelist is not checked by resourcecompiler. A violating vxml passes with
`OK: 1 compiled, 0 failed` and is only rejected when the client loads it — and it
takes the whole layout down with it, so the symptom is "the HUD doesn't appear at
all." Never treat a successful compile as verification.

> The raw list of all 140 registered property names — the
> `dump_panorama_css_properties` vocabulary, straight from `libpanorama.so`'s
> CStylePropertyFactory — now lives in
> [Panorama CSS Property Registry](panorama-css-properties.md).

---

Sources: `libpanorama.so` property registrations / CS2 stock vcss / live
verification (2026-08).
