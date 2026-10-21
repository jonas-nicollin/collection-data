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
