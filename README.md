# Smartmanteau

Smartmanteau is a deterministic, offline portmanteau generator that uses editable phonological rules instead of AI or web services.

## Open the tool

1. Unzip the Smartmanteau folder.
2. Open `index.html` in a modern browser.
3. Enter two words or names.
4. Optionally add syllable guides and stress positions.
5. Select priorities and manipulation options.
6. Choose **Generate portmanteaus**.

No installation, account, server, API key, or internet connection is required. All app code is stored in the folder and uses relative file paths.

## What the first version supports

- Best, Good, and Other result sections rather than visible numerical scores
- Literal prefix/suffix splicing in both word orders
- Editable syllable guides
- User-entered primary stress
- Fairness prioritization
- Stress-aware prioritization
- C/V syllable-shape limits
- Editable vowel and consonant clusters
- Exact shared overlaps
- Optional deletion of unstressed or light material
- Optional metathesis, such as `dor` becoming `dro`
- Optional compatible-sound bridges defined by the user
- Optional repeated-boundary compression
- Search across every generated candidate
- Filters for literal splices, overlaps, deletion, metathesis, and compatible-sound bridges
- Paginated result cards so large candidate sets stay responsive
- Light and dark themes
- Keyboard navigation, visible focus, large controls, semantic labels, and screen-reader announcements
- Local preference saving in the browser

## Important design note

Smartmanteau does not claim that spelling alone can perfectly recover pronunciation. For unusual names, languages, conlangs, or fictional words, the syllable guides and custom phonology fields are the source of truth.

A syllable guide must use the same letters as the original word, separated with hyphens. For example:

- `Jonathan` → `Jon-a-than`
- `Doris` → `Dor-is`
- `Sierra` → `Si-er-ra`

Primary stress is entered as a number. `1` means the first syllable.

## Compatible sound groups

One group goes on each line. A label is optional.

```text
Long E = ee/ea/e/i
O bridge = o/au/aw
F sound = f/ph
```

Brackets are accepted too:

```text
[ee/i/y]
[o/au/aw]
```

These groups do not cause unrestricted letter substitution. Smartmanteau uses them at joins and vowel-nucleus bridges when the compatible-sound option is enabled.

## Files

- `index.html` — page structure and accessible controls
- `styles.css` — high-contrast light/dark design
- `engine.js` — deterministic generation engine
- `app.js` — browser interface, result rendering, copying, examples, and local settings
- `tests/engine.test.js` — basic engine checks

## Run the optional tests

With Node.js installed, run this command from the Smartmanteau folder:

```bash
node tests/engine.test.js
```

## Color and contrast choices

- Page background: white in light mode and near-black in dark mode
- Main text: black in light mode and white in dark mode
- Generate button: `#9900ff` with white text
- Text fields: `#808080` with black text for stronger contrast

## Result organization

Smartmanteau does not display a numerical quality score. It uses the selected priorities to place candidates into **Best outcomes**, **Good outcomes**, and **Other legal blends**. Changing a priority can move a candidate between sections, while changing a generation toggle can add or remove whole families of candidates.
