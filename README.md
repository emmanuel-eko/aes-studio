# AES Studio

Atelier pédagogique pour **AES-128** et les modes **CBC**, **CTR** et **GCM**.

Alice chiffre un message, Oscar peut intercepter le canal, Bob déchiffre. Chaque transformation affichée vient du moteur Python, pas d’une animation fictive.

Cette implémentation est destinée à l’enseignement. Elle n’est pas une bibliothèque de production : Python ne garantit pas un temps d’exécution constant, et les états intermédiaires sont volontairement exposés.

## Lancer en local

Prérequis : Python 3.12+, Node 22+.

```bash
cp .env.example .env

# Backend
cd backend
python3 -m pip install -r requirements.txt
python3 -m pytest
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 48180

# Frontend (autre terminal)
cd frontend
npm install
npm run dev
```

Ouvrir [http://127.0.0.1:43123](http://127.0.0.1:43123). Vite proxy `/api` vers le backend.

## Vercel

Le dépôt se déploie tel quel sur Vercel : le front Vite est servi en statique,
l’API FastAPI répond sur `/api`.

```bash
npx vercel
```

## Docker

```bash
docker compose up --build
```

Le frontend écoute sur le port 43123 et relaie `/api` vers FastAPI.

## Tests

```bash
cd backend && python3 -m pytest
```

Les vecteurs NIST / FIPS 197 utilisés sont listés dans `documentation/rapport_technique.md`.

## Documentation

- `documentation/architecture.md`
- `documentation/guide_installation.md`
- `documentation/rapport_technique.md`
