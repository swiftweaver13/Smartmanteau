# Smartmanteau

Smartmanteau is a deterministic, offline portmanteau generator that uses editable phonological rules instead of AI or web services.

## Open the tool

1. Unzip the Smartmanteau folder.
2. Open `index.html` in a modern browser.
3. Enter two words or names.
4. Choose **Generate portmanteaus**.

That is all you need for normal use. Pronunciation details, priorities, manipulation options, and custom sound rules are optional.

No installation, account, server, API key, or internet connection is required. All app code is stored in the folder and uses relative file paths.

## Interface

- **Generator** is the main tab. It keeps the two source words front and center.
- **Pronunciation details** is a collapsible optional section for syllable breaks and stress.
- **Advanced settings** is a collapsible section for manipulation and result priorities.
- **Sound setup** is a separate tab for custom vowels, clusters, syllable shapes, compatible sounds, and sound classes.
- The moon/sun button in the upper-right switches between light and dark mode. Light mode is the default.

## What Smartmanteau supports

- Best, Good, and More result sections rather than visible numerical scores
- A **None** priority option so no single preference has to come first
- Literal prefix/suffix splicing in both word orders
- Editable syllable guides
- Optional primary-stress guidance
- Fairness prioritization
- C/V syllable-shape limits
- Editable vowel and consonant clusters
- Exact shared overlaps
- Optional deletion of unstressed or light material
- Optional metathesis, such as `dor` becoming `dro`
- Optional compatible-sound bridges defined by the user
- Optional repeated-boundary compression
- Search and generation-type filters
- Paginated result cards so large candidate sets stay responsive
- Light and dark themes
- Keyboard navigation, visible focus, large controls, semantic labels, and screen-reader announcements
- Local preference saving in the browser

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
- `styles.css` — modern high-contrast light/dark design
- `engine.js` — deterministic generation engine
- `app.js` — browser interface, result rendering, tabs, copying, examples, and local settings
- `tests/engine.test.js` — basic engine checks

## Run the optional tests

With Node.js installed, run this command from the Smartmanteau folder:

```bash
node tests/engine.test.js
```

## Colors

- Light background: white
- Light text: black
- Dark mode: near-black with white text
- Generate button: `#9900ff` with white text
- Text fields: `#808080` with black text

## Result organization

Smartmanteau does not display a numerical quality score. Priorities affect whether candidates appear in **Best outcomes**, **Good outcomes**, or **More outcomes**. Generation toggles work differently: they decide whether whole families of manipulated candidates can be generated at all.
