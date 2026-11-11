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

