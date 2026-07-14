# Product content (metadata.content) — source of truth

Medusa Admin cannot edit `metadata.content` (its metadata table stores
primitives only, and this is a nested object). This folder is the source of
truth for product copy — one JSON file per product, named by product handle
(e.g. `oxandrolone-zphc.json`).

## Workflow

1. Create/edit `content/<handle>.json` (shapes below).
2. `npx medusa exec ./src/scripts/import-content.ts <handle>` — or no handle
   to import every file. Add the bare token `dry-run` (not `--dry-run` —
   medusa exec's CLI rejects `--options`) to preview without writing.
3. `npx medusa exec ./src/scripts/export-content.ts [<handle>]` pulls existing
   DB content back into this folder (bootstrap a new file / keep in sync).

Every import is validated against the same zod schema the Admin API enforces
(`src/utils/product-content-schema.ts`); an invalid file is rejected naming the
field and nothing is written. Other metadata keys (`rank`, `template`, specs)
are never touched. `type` must be `"compound"` or `"peptide"`.

Optional fields (any product): `alsoKnownAs` (string[]), `coaUrl` (url),
`faq` ([{q, a}]), `contentBlocks` (see below). Peptide also allows optional
`stacking` ([{productHandle, label}]). Everything else shown is required.

Special top-level key `active_ingredient` (string, optional): the active
substance, e.g. `"Oxandrolone"`. It is NOT part of the content object — on
import it is split out into the flat `metadata.active_ingredient` (which feeds
the product-page subtitle "Oxandrolone — also known as Anavar"). Keep it here
in the file for convenience; the script routes it to the right place.

`contentBlocks` entries — each needs a `type`: `text`/`callout`
(`{type, title?, body}`), `image` (`{type, url, caption?}`), or
`table` (`{type, headers: string[], rows: string[][]}`).

## Compound shape (filled example)

```json
{
  "type": "compound",
  "active_ingredient": "Oxandrolone",
  "overview": {
    "what": "Oxandrolone is a mild oral anabolic steroid derived from DHT.",
    "howItWorks": "Binds to androgen receptors and increases nitrogen retention with minimal androgenic activity."
  },
  "dosage": {
    "beginner": "20–30 mg/day",
    "intermediate": "40–60 mg/day",
    "advanced": "80 mg/day",
    "cycleLength": "6–8 weeks",
    "administration": "Oral, split into two doses (short half-life)",
    "pct": "Nolvadex 20 mg/day for 4 weeks"
  },
  "profile": {
    "anabolicRating": "322–630",
    "androgenicRating": "24",
    "ester": "None (oral)",
    "halfLife": "9 hours",
    "aromatization": "No",
    "detectionTime": "3 weeks"
  },
  "sideEffects": {
    "estrogenic": "None",
    "androgenic": "Low",
    "cardiovascular": "Moderate — lipid strain",
    "suppression": "Moderate"
  },
  "alsoKnownAs": ["Anavar", "Var"],
  "coaUrl": "https://cdn.onyxgenetics.com/coa/oxandrolone-batch-123.pdf",
  "faq": [
    { "q": "Is this lab tested?", "a": "Yes, see the COA link on this page." }
  ],
  "contentBlocks": [
    { "type": "text", "title": "Optional free-form section", "body": "Any extra copy." }
  ]
}
```

## Peptide shape (filled example)

```json
{
  "type": "peptide",
  "overview": {
    "what": "BPC-157 is a synthetic peptide derived from a protective protein in gastric juice.",
    "mechanism": "Promotes angiogenesis and upregulates growth factor receptors in tendon and ligament tissue."
  },
  "keyHighlights": [
    "Studied for tendon and ligament recovery",
    "Systemic and local administration both researched",
    "No aromatization, no androgenic activity"
  ],
  "research": {
    "useCases": "Investigated in animal models for tendon-to-bone healing, ligament repair, and gut lining protection.",
    "models": "Rodent studies (rat, mouse); no approved human clinical use."
  },
  "stacking": [
    { "productHandle": "tb-500-zphc", "label": "TB-500 (synergistic recovery)" }
  ],
  "alsoKnownAs": ["BPC-157", "Body Protection Compound"],
  "faq": [
    { "q": "Is this for human use?", "a": "No — research purposes only." }
  ]
}
```
