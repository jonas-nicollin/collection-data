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
