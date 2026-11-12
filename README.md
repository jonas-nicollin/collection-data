# Collection Data

Ce repo publie des donnees JSON statiques pour les blocs Squarespace.

## Flux

```txt
Google Sheet
-> GitHub Actions
-> JSON dans public/data
-> Cloudflare Pages
-> Squarespace
```

## Commandes

Generer le JSON des lieux PCC:

```sh
npm run build:locations
```

Sortie:

```txt
public/data/locations/pcc.json
```

## Cloudflare Pages

Reglages recommandes:

```txt
Framework preset: None
Build command: laisser vide
Build output directory: public
Production branch: main
```

L'URL finale aura cette forme:

```txt
https://collection-data.pages.dev/data/locations/pcc.json
```

## Dimensions intrinsèques des images

Le builder conserve par défaut `imageDimensions: { "width": 1500, "height": 2262 }`
quand Squarespace fournit une paire valide dans `originalSize`. Aucun fichier
image n'est téléchargé et aucune option par collection n'est nécessaire.
La propriété est facultative et absente quand la taille est inconnue.

Pour les produits, chaque entrée image de `media` conserve ses dimensions ;
les dimensions de l'item correspondent à l'image principale effectivement choisie.
L'adaptateur Index ajoute les dimensions aux images et conserve le contrat vidéo.
Les champs existants, le schéma v1, les prix, l'ordre et les catégories sont inchangés.
Les consommateurs qui ignorent cette nouvelle propriété restent compatibles.

## Galeries natives optionnelles

Une entrée de collection peut activer `"nativeGallery": true` pour recueillir
les images des blocs galerie natifs présents dans le `body` fourni par Squarespace.
Le builder ajoute alors `gallery` : une liste ordonnée d'images avec `assetUrl`,
`imageDimensions` lorsqu'elles sont connues, `mediaFocalPoint` et `alt`.
Les images hors galerie et les doublons `noscript` sont ignorés.
Aucune requête supplémentaire n'est faite. Sans cette option, la sortie reste
strictement inchangée. Une galerie absente donne une liste vide.
Cette option ne remplace ni l'image principale ni le champ `media`.


## Optional multiline location hours

The location builder supports opt-in column mappings `columns.hours` and
`columns.datedHours`. Both are multiline text fields; one entry per line:

- Weekly: `lundi: Fermé` or `mardi: 11h–18h`.
- Dated: `2026-09-20: 11h–17h` or `2026-09-20: Fermé`.

They produce `openingHours: { weekly: {}, dates: {} }` only for populated rows.
Blank days remain unknown. A weekly multiline field, when filled, supersedes
the old individual weekday columns for consumers that support this object.
The legacy flat fields remain unchanged for older consumers. Without these
column mappings, the builder output is unchanged. Invalid/repeated day or date
keys fail the build rather than publishing an ambiguous schedule.


### Optional location source for collection records

A collection may opt into `locationSource: { file, matchField, replaceLocation }`
or `{ file, tagPrefixes }`. The file is a previously built locations JSON payload.
`matchField: "title"` resolves member records. Ordered `tagPrefixes` resolve the
actual venue before the organizer. An explicit unmatched or ambiguous first
prefix never falls back to a later prefix. Only unique matches are attached as
`venue: { key, title, matchedBy, location, openingHours }`; unresolved records keep
all their original content and receive `venueMatch` diagnostics.

`replaceLocation: true` explicitly replaces native location metadata with that
source, including removal of stale coordinates when the source has none. It is
not enabled by default. Consumers without `locationSource` remain unchanged.
Dated hours and weekly hours are separate; this join does not infer availability.

For Google Sheets gviz sources, use `headers=1` when there is one header row.
Location builds reject zero records by default; an intentionally empty source
must set `allowEmpty: true`. This protects the last published payload when a
source response is malformed. Location and collection rebuilds run separately;
collection joins use the latest locations payload committed to the repository.

### Optional location aliases

`columns.aliases` maps an optional column containing one alternate place name
per line. The builder emits `aliases` only when this mapping is configured.
The location join accepts those names alongside title, slug and matchKey.
Duplicate names belonging to different places remain ambiguous; no place is
chosen arbitrarily. Native `location` stays unchanged unless replaceLocation
is explicitly enabled. Rejoining clears obsolete venue/venueMatch diagnostics.
