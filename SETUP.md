# GitHub + Supabase beállítás

## 1. Supabase
1. Nyisd meg a Supabase-t és hozz létre egy új projektet.
2. SQL Editor → New query.
3. Másold be a `supabase.sql` teljes tartalmát.
4. Run.
5. Authentication → Users → Add user: hozz létre egy fiókot.
6. A felhasználó UUID-ját írd be a `profiles` táblába a SQL Editorból.

Példa ReFoMix felhasználóra:

```sql
insert into public.profiles(id,full_name,organization_id,role)
values(
  'A-FELHASZNALO-UUID-JA',
  'ReFoMix felhasználó',
  (select id from public.organizations where name='ReFoMix'),
  'member'
);
```

Ugyanez a `Közterület` és `Rendőrség` esetén.

## 2. GitHub
Töltsd fel a következő fájlokat egy repositoryba:

- index.html
- app.js
- config.js
- style.css
- supabase.sql
- SETUP.md

## 3. Supabase API adatok
Supabase → Project Settings → API.

A `config.js` fájlba írd be:
- Project URL
- Publishable/anon key

A publikus kulcs a frontendben használható; a service role kulcsot SOHA ne tedd GitHubra.

## 4. GitHub Pages
Repository → Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.

## 5. Működés

ReFoMix felhasználó:
- látja az összes közös bejegyzést
- csak a saját szervezeti jogosultságával módosíthat
- a módosítás bekerül az audit naplóba

Közterület és Rendőrség ugyanígy saját szervezeti hozzáféréssel működik.

## 6. Fontos adatvédelmi megjegyzés

Ha a rendszerben személyes vagy érzékeny adatok lesznek, a végleges adatmodellt, hozzáféréseket, adatmegőrzést és a Supabase beállításait adatvédelmi/jogi szempontból is ellenőrizni kell. A publikus GitHub repositoryba személyes adatot, jelszót vagy service-role kulcsot ne tölts fel.
