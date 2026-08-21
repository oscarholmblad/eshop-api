# E-shop API

Ett REST API för en produktkatalog i en e-shop. Hanterar produkter och kategorier.

## Projektbeskrivning

Inlämning 1 i kursen API-utveckling. Målet har varit att göra ett normaliserat ER-diagram
och ett API med CRUD för produkter och kategorier.

En produkt kan tillhöra flera kategorier, vilket löses med en kopplingstabell.

## Funktioner

- CRUD för produkter
- CRUD för kategorier
- Hämta alla produkter i en viss kategori
- Sök produkter på titel
- Sortera produkter på pris, både stigande och fallande
- Validering av obligatoriska fält vid POST och PATCH
- Felhantering med HTTP-statuskoder och felmeddelanden

## Tekniker

- Node.js
- Express
- TypeScript
- MySQL med mysql2
- dotenv
- cors

## Databasstruktur

| Tabell               | Fält                                                           |
| -------------------- | -------------------------------------------------------------- |
| `categories`         | id (PK), name                                                  |
| `products`           | id (PK), title, description, stock, price, image, created_date |
| `product_categories` | product_id (FK), category_id (FK)                              |

`product_categories` är en kopplingstabell som gör relationen många-till-många.
Primärnyckeln är `(product_id, category_id)` tillsammans, vilket hindrar att samma
koppling läggs in två gånger. De främmande nycklarna mot `products` och `categories`
gör att en produkt bara kan kopplas till en kategori som finns. `ON DELETE CASCADE`
städar bort kopplingarna automatiskt när en produkt eller kategori raderas.

- ER-diagram: `er-diagram.png`
- SQL-export med testdata: `database.sql`

## Kom igång

Installera paket:

```bash
npm install
```

Skapa en `.env` med samma variabler som i `.env.example`.

Importera databasen med testdata:

```bash
mysql -u root -p < database.sql
```

Starta servern:

```bash
npm run dev
```

Servern kör på `http://localhost:3000`.

## Scripts

| Kommando        | Gör                                             |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Startar servern med tsx, startar om vid ändring |
| `npm run build` | Kompilerar TypeScript till `dist`               |
| `npm start`     | Kör den kompilerade koden                       |

## Endpoints

### Kategorier

| Metod  | URL                        | Beskrivning                  |
| ------ | -------------------------- | ---------------------------- |
| GET    | `/categories`              | Alla kategorier              |
| GET    | `/categories/:id/products` | Alla produkter i en kategori |
| POST   | `/categories`              | Skapa kategori               |
| PATCH  | `/categories/:id`          | Uppdatera kategori           |
| DELETE | `/categories/:id`          | Radera kategori              |

Body för POST och PATCH:

```json
{ "name": "Elektronik" }
```

### Produkter

| Metod  | URL             | Beskrivning       |
| ------ | --------------- | ----------------- |
| GET    | `/products`     | Alla produkter    |
| GET    | `/products/:id` | En produkt        |
| POST   | `/products`     | Skapa produkt     |
| PATCH  | `/products/:id` | Uppdatera produkt |
| DELETE | `/products/:id` | Radera produkt    |

Body för POST:

```json
{
  "title": "Trådlös mus Pro",
  "description": "Ergonomisk trådlös mus med sex knappar",
  "stock": 42,
  "price": 349.0,
  "image": "https://picsum.photos/seed/mouse/400/400",
  "categories": [1, 2]
}
```

### Sökning och sortering

| Query    | Exempel                | Beskrivning                |
| -------- | ---------------------- | -------------------------- |
| `search` | `/products?search=mus` | Söker på produkttitel      |
| `sort`   | `/products?sort=asc`   | Sorterar på pris, stigande |
| `sort`   | `/products?sort=desc`  | Sorterar på pris, fallande |

Går att kombinera: `/products?search=mus&sort=desc`

## Validering

`title`, `description`, `stock` och `price` är obligatoriska vid POST.
`image` och `categories` är valfria.

PATCH är en delvis uppdatering, så alla fält krävs inte. Men de fält som skickas med
måste vara giltiga, och en tom body avvisas.

## Statuskoder

| Kod | När                                                       |
| --- | --------------------------------------------------------- |
| 200 | Lyckad GET, PATCH eller DELETE                            |
| 201 | Ny resurs skapad                                          |
| 400 | Valideringsfel, ogiltigt id eller ogiltig query-parameter |
| 404 | Resursen eller endpointen finns inte                      |
| 409 | Kategorinamnet finns redan                                |
| 500 | Serverfel                                                 |

Felsvar har formen:

```json
{
  "error": "Valideringsfel",
  "details": ["Fältet title får inte vara tomt"]
}
```
