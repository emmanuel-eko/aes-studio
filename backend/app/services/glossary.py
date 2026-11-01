"""Short and long explanations shown next to the simulation."""

from __future__ import annotations

from app.models.schemas import GlossaryTerm

TERMS: list[GlossaryTerm] = [
    GlossaryTerm(
        id="block-cipher",
        title="Chiffrement par bloc",
        summary="AES traite le message par blocs de 128 bits, pas bit à bit.",
        detail=(
            "Un chiffrement par bloc applique une permutation paramétrée par la clé "
            "à des blocs de taille fixe. AES utilise 128 bits. Un mode opératoire "
            "dit ensuite comment enchaîner les blocs d'un message plus long."
        ),
    ),
    GlossaryTerm(
        id="aes",
        title="AES",
        summary="Advanced Encryption Standard, ici en version 128 bits et 10 tours.",
        detail=(
            "AES-128 chiffre un bloc de 16 octets avec une clé de 16 octets. "
            "Dix tours mélangent SubBytes, ShiftRows, MixColumns et AddRoundKey. "
            "Cette implémentation est pédagogique : elle n'est pas destinée à la production."
        ),
    ),
    GlossaryTerm(
        id="mode",
        title="Mode opératoire",
        summary="Règle qui étend AES d'un bloc à un message entier.",
        detail=(
            "CBC enchaîne les blocs. CTR fabrique un flux de clés. "
            "GCM ajoute une authentification. Le mode change la sécurité obtenue, "
            "pas seulement l'apparence du chiffré."
        ),
    ),
    GlossaryTerm(
        id="iv",
        title="Vecteur d'initialisation",
        summary="Valeur publique qui démarre le chaînage CBC.",
        detail=(
            "L'IV ne se garde pas secret, mais il doit être imprévisible et unique "
            "pour une clé donnée. Il empêche que deux messages identiques "
            "produisent le même chiffré."
        ),
    ),
    GlossaryTerm(
        id="nonce",
        title="Nonce",
        summary="Nombre à usage unique, ici 96 bits pour GCM.",
        detail=(
            "Un nonce ne se répète jamais avec la même clé. En GCM, le réutiliser "
            "révèle le XOR des clairs et casse l'authentification. "
            "Le studio refuse un couple (clé, nonce) déjà vu."
        ),
    ),
    GlossaryTerm(
        id="padding",
        title="Padding PKCS#7",
        summary="Remplit le dernier bloc CBC jusqu'à 16 octets.",
        detail=(
            "PKCS#7 ajoute n octets de valeur n. Si le message est déjà aligné, "
            "un bloc entier de 16 est ajouté. CTR et GCM n'en ont pas besoin."
        ),
    ),
    GlossaryTerm(
        id="xor",
        title="XOR",
        summary="Addition bit à bit dans GF(2) : 1⊕1=0, involutive.",
        detail=(
            "Le XOR mélange deux blocs. L'appliquer deux fois avec la même valeur "
            "annule l'opération. CBC et CTR s'appuient dessus ; une modification "
            "du chiffré s'y propage de façon différente selon le mode."
        ),
    ),
    GlossaryTerm(
        id="sbox",
        title="S-Box",
        summary="Substitution non linéaire : inverse dans GF(2^8) puis affine.",
        detail=(
            "La S-Box d'AES n'est pas une table magique. Chaque octet est inversé "
            "dans GF(2^8), puis passé dans une transformation affine. "
            "C'est la seule non-linéarité d'un tour."
        ),
    ),
    GlossaryTerm(
        id="subbytes",
        title="SubBytes",
        summary="Remplace chaque octet de l'état par S-Box[octet].",
        detail=(
            "SubBytes s'applique indépendamment à chaque octet de la matrice 4×4. "
            "InvSubBytes utilise la S-Box inverse."
        ),
    ),
    GlossaryTerm(
        id="shiftrows",
        title="ShiftRows",
        summary="Rotation à gauche de la ligne r de r positions.",
        detail=(
            "ShiftRows disperse les octets d'une colonne vers d'autres colonnes. "
            "Sans cette étape, MixColumns ne mélangerait que quatre octets isolés."
        ),
    ),
    GlossaryTerm(
        id="mixcolumns",
        title="MixColumns",
        summary="Mélange linéaire d'une colonne dans GF(2^8).",
        detail=(
            "Chaque colonne est multipliée par un polynôme fixe. "
            "Avec ShiftRows, cela donne la diffusion d'AES : un octet influence "
            "tout le bloc après quelques tours."
        ),
    ),
    GlossaryTerm(
        id="addroundkey",
        title="AddRoundKey",
        summary="XOR de l'état avec la clé de tour.",
        detail=(
            "C'est le seul endroit où la clé entre dans le calcul d'un tour. "
            "L'opération est identique au chiffrement et au déchiffrement."
        ),
    ),
    GlossaryTerm(
        id="key-expansion",
        title="Key Expansion",
        summary="Dérive 11 clés de tour à partir de la clé de 16 octets.",
        detail=(
            "RotWord, SubWord et un XOR avec Rcon produisent 44 mots. "
            "Chaque AddRoundKey en consomme quatre."
        ),
    ),
    GlossaryTerm(
        id="gf256",
        title="Corps fini GF(2^8)",
        summary="Octets additionnés par XOR, multipliés modulo x^8+x^4+x^3+x+1.",
        detail=(
            "AES calcule dans GF(2^8). xtime multiplie par {02}. "
            "L'inverse multiplicatif alimente la S-Box. "
            "Ce n'est pas l'arithmétique entière habituelle."
        ),
    ),
    GlossaryTerm(
        id="cbc",
        title="AES-CBC",
        summary="Chaque bloc clair est XOR-é avec le chiffré précédent.",
        detail=(
            "Le premier bloc utilise l'IV. Une modification d'un bloc chiffré "
            "altère le bloc clair correspondant et le suivant. "
            "CBC ne détecte pas cette modification."
        ),
    ),
    GlossaryTerm(
        id="ctr",
        title="AES-CTR",
        summary="AES chiffre un compteur ; le flux est XOR-é au message.",
        detail=(
            "Pas de padding. Les blocs sont indépendants. "
            "Inverser un bit du chiffré inverse le même bit du clair. "
            "Chiffrement et déchiffrement sont la même opération."
        ),
    ),
    GlossaryTerm(
        id="gcm",
        title="AES-GCM",
        summary="CTR pour le secret, GHASH pour authentifier.",
        detail=(
            "GCM sépare confidentialité et authentification. "
            "Le tag doit être vérifié avant de restituer le clair. "
            "Modifier C, l'AAD ou le tag fait échouer Bob."
        ),
    ),
    GlossaryTerm(
        id="ghash",
        title="GHASH",
        summary="Hash polynomial dans GF(2^128), clé H = AES_K(0).",
        detail=(
            "GHASH accumule (Y ⊕ X_i) · H. Il authentifie le chiffré, "
            "les données associées et leurs longueurs. Il ne remplace pas AES."
        ),
    ),
    GlossaryTerm(
        id="authentication-tag",
        title="Tag d'authentification",
        summary="Résumé de 128 bits que Bob doit retrouver à l'identique.",
        detail=(
            "Le tag lie nonce, AAD et chiffré. Sans tag valide, GCM refuse "
            "de parler du message. CBC et CTR n'en ont pas."
        ),
    ),
    GlossaryTerm(
        id="confidentiality",
        title="Confidentialité",
        summary="Oscar ne doit pas lire le message d'Alice.",
        detail=(
            "Le chiffrement vise la confidentialité. Seul il ne dit rien sur "
            "l'intégrité : Oscar peut encore altérer des bits."
        ),
    ),
    GlossaryTerm(
        id="integrity",
        title="Intégrité",
        summary="Bob doit détecter toute modification du message.",
        detail=(
            "L'intégrité n'est pas offerte par CBC ou CTR seuls. "
            "GCM la fournit via le tag. C'est l'enjeu pédagogique du mode attaquant."
        ),
    ),
    GlossaryTerm(
        id="authentication",
        title="Authentification",
        summary="La preuve que le message vient d'une partie qui connaît la clé.",
        detail=(
            "En GCM, un tag correct authentifie l'origine sous l'hypothèse "
            "que seule Alice (et Bob) possède la clé. Oscar sans la clé "
            "ne peut pas forger un tag acceptable."
        ),
    ),
    GlossaryTerm(
        id="ciphertext-tampering",
        title="Attaque par modification du chiffré",
        summary="Oscar change des octets en transit et observe l'effet chez Bob.",
        detail=(
            "CBC : un bloc est brouillé, le suivant est modifié de façon contrôlée. "
            "CTR : la modification du clair est locale et prévisible. "
            "GCM : le tag échoue, aucun clair n'est montré."
        ),
    ),
]


def all_terms() -> list[GlossaryTerm]:
    return list(TERMS)


def term_map() -> dict[str, GlossaryTerm]:
    return {term.id: term for term in TERMS}
