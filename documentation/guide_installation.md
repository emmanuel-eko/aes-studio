# Guide d’installation — AES Studio

## Prérequis

- Python 3.12 ou plus récent
- Node.js 22 ou plus récent
- Un navigateur actuel
- Docker (optionnel)

Aucune clé d’API externe n’est requise.

## Variables d’environnement

Copier `.env.example` vers `.env` à la racine si vous souhaitez les surcharger.

| Variable | Rôle | Exemple |
| --- | --- | --- |
| `AES_STUDIO_PORT` | Port FastAPI | `48180` |
| `AES_STUDIO_CORS_ORIGINS` | Origines autorisées | `http://127.0.0.1:43123` |
| `AES_STUDIO_MAX_MESSAGE_BYTES` | Taille max pédagogique | `256` |
| `VITE_API_BASE_URL` | URL API pour le build frontend | vide en dev (proxy Vite) |

## Installation locale

### Backend

```bash
cd backend
python3 -m pip install -r requirements.txt
python3 -m pytest
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 48180
```

Vérifier : `http://127.0.0.1:48180/api/health`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Ouvrir `http://127.0.0.1:43123`. En développement, Vite relaie `/api` vers le port 48180.

## Docker Compose

```bash
docker compose up --build
```

- Interface : `http://127.0.0.1:43123`
- API : `http://127.0.0.1:48180/api/health`

Nginx du frontend proxy `/api` vers le service `backend`.

## Production

1. Construire le frontend avec `VITE_API_BASE_URL` vide si le reverse-proxy sert `/api` sur le même hôte.
2. Lancer Uvicorn derrière un reverse-proxy (Nginx, Caddy).
3. Restreindre `AES_STUDIO_CORS_ORIGINS` aux origines réelles.
4. Ne pas exposer cet AES maison comme service de confidentialité.

Exemple Caddy :

```
studio.example {
    reverse_proxy /api/* backend:48180
    reverse_proxy frontend:80
}
```
