# Architecture — AES Studio

## Objectif

AES Studio est une application pédagogique qui exécute un vrai AES-128 (et les modes CBC, CTR, GCM) côté serveur Python, puis expose chaque transformation sous forme de trace pas-à-pas pour le frontend React.

Aucune valeur affichée n’est inventée pour l’animation : la trace est le journal des calculs réellement effectués.

## Décision d’architecture

| Sujet | Choix | Raison |
| --- | --- | --- |
| Moteur crypto | Python maison, modules séparés | Exigence du cahier des charges ; lisibilité pédagogique |
| API | FastAPI, REST JSON | Typage Pydantic, CORS simple, tests HTTP |
| Frontend | Vite + React + TypeScript + Tailwind + Framer Motion | Stack demandée, boucle de dev rapide |
| État de simulation | Trace pré-calculée, lecture côté client | Reculer d’une étape ne relance pas un calcul incohérent |
| Clés | Générées par `secrets` ; jamais journalisées | Aléatoire cryptographique, pas de fuite dans les logs |
| Déploiement | Docker Compose (frontend Nginx + backend Uvicorn) | Le moteur Python n’est pas un site statique |

## Flux principal

```
Alice (UI)
  → POST /api/session/encrypt   {plaintext, mode, key, iv/nonce, aad}
  → moteur AES + mode
  → TraceStep[] + ciphertext + tag?
Oscar (UI, optionnel)
  → modification d’octets du ciphertext / tag
  → POST /api/session/decrypt   {ciphertext modifié, key, …}
Bob (UI)
  → lecture de la trace de déchiffrement
  → clair seulement si le mode l’autorise (GCM : tag valide)
```

## Modules cryptographiques

```
backend/app/cryptography/
  gf256.py           GF(2^8), xtime, multiplication, inverse
  sbox.py            génération S-Box / InvS-Box (inverse + affine)
  key_expansion.py   expansion de clé AES-128 (10 tours)
  aes.py             SubBytes, ShiftRows, MixColumns, AddRoundKey, bloc
  padding.py         PKCS#7
  cbc.py             AES-CBC
  ctr.py             AES-CTR
  ghash.py           multiplication GF(2^128) + GHASH
  gcm.py             AES-GCM (CTR + GHASH + tag)
  traces.py          collecteur d’étapes pédagogiques
  utils.py           hex, bin, matrices 4×4, XOR
```

## Frontend

Trois espaces synchronisés (Alice / canal / Bob) sur la page Studio, plus deux rubriques :

- `/` — studio de simulation
- `/bibliotheque` — code Python réel, téléchargement
- `/notions` — glossaire détaillé

Les sept représentations (texte, octets, binaire, hex, matrice, opérations, chiffré) sont masquables individuellement.

## Limite pédagogique

Cette implémentation n’est pas une bibliothèque de production : Python ne garantit pas un temps d’exécution constant, et le code expose volontairement les états intermédiaires.
