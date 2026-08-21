import { Router, Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";

const router = Router();

// Beskriver hur en rad ur tabellen ser ut, så att TypeScript vet vad queryn ger tillbaka
interface Product extends RowDataPacket {
  id: number;
  title: string;
  description: string;
  stock: number;
  price: number;
  image: string | null;
  created_date: string;
}

interface CategoryRow extends RowDataPacket {
  product_id: number;
  id: number;
  name: string;
}

interface IdRow extends RowDataPacket {
  id: number;
}

const PRODUCT_FIELDS =
  "p.id, p.title, p.description, p.stock, p.price, p.image, p.created_date";

// Kollar att produktdatan är giltig. Returnerar en lista med fel, tom lista betyder att allt är okej.
// isPatch = true betyder att fälten inte behöver finnas med, men skickas de med måste de vara giltiga.
function validateProduct(body: any, isPatch: boolean): string[] {
  const errors: string[] = [];

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return ["Request body måste vara ett objekt"];
  }

  const has = (field: string) =>
    Object.prototype.hasOwnProperty.call(body, field);
  const required = ["title", "description", "stock", "price"];

  if (!isPatch) {
    for (const field of required) {
      if (!has(field)) errors.push(`Fältet ${field} är obligatoriskt`);
    }
  }

  const allowed = [...required, "image", "categories"];

  if (isPatch && !allowed.some(has)) {
    errors.push(`Skicka med minst ett av fälten: ${allowed.join(", ")}`);
  }

  if (
    has("title") &&
    (typeof body.title !== "string" || body.title.trim() === "")
  ) {
    errors.push("Fältet title får inte vara tomt");
  }

  if (
    has("description") &&
    (typeof body.description !== "string" || body.description.trim() === "")
  ) {
    errors.push("Fältet description får inte vara tomt");
  }

  if (has("stock")) {
    const stock = Number(body.stock);
    if (
      body.stock === null ||
      body.stock === "" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      errors.push("Fältet stock måste vara ett heltal från 0 och uppåt");
    }
  }

  if (has("price")) {
    const price = Number(body.price);
    if (
      body.price === null ||
      body.price === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      errors.push("Fältet price måste vara ett tal från 0 och uppåt");
    }
  }

  if (has("image") && body.image !== null && typeof body.image !== "string") {
    errors.push("Fältet image måste vara en text eller null");
  }

  if (has("categories")) {
    if (!Array.isArray(body.categories)) {
      errors.push("Fältet categories måste vara en array med kategori-id");
    } else if (
      !body.categories.every(
        (c: unknown) => Number.isInteger(Number(c)) && Number(c) > 0,
      )
    ) {
      errors.push("Fältet categories får bara innehålla positiva heltal");
    }
  }

  return errors;
}

// Hämtar kategorierna till produkterna och lägger till dem som en categories-array.
// En query för hela listan istället för en query per produkt.
async function addCategories(products: Product[]) {
  if (products.length === 0) return [];

  const ids = products.map((p) => p.id);

  const [rows] = await pool.query<CategoryRow[]>(
    `SELECT pc.product_id, c.id, c.name
     FROM product_categories pc
     INNER JOIN categories c ON c.id = pc.category_id
     WHERE pc.product_id IN (?)
     ORDER BY c.name`,
    [ids],
  );

  return products.map((product) => ({
    ...product,
    categories: rows
      .filter((row) => row.product_id === product.id)
      .map((row) => ({ id: row.id, name: row.name })),
  }));
}

// Returnerar de kategori-id som inte finns i databasen
async function findMissingCategories(connection: any, categoryIds: number[]) {
  if (categoryIds.length === 0) return [];

  const [rows] = await connection.query(
    "SELECT id FROM categories WHERE id IN (?)",
    [categoryIds],
  );
  const existing = (rows as IdRow[]).map((row) => row.id);

  return categoryIds.filter((id) => !existing.includes(Number(id)));
}

// Hämtar alla produkter.
// Går att söka på titel med ?search och sortera på pris med ?sort=asc eller ?sort=desc.
router.get("/", async (req: Request, res: Response) => {
  try {
    const { search, sort } = req.query;
    const params: string[] = [];
    let sql = `SELECT ${PRODUCT_FIELDS} FROM products p`;

    if (search !== undefined) {
      if (typeof search !== "string" || search.trim() === "") {
        return res.status(400).json({ error: "Sökordet får inte vara tomt" });
      }

      sql += " WHERE p.title LIKE ?";
      params.push(`%${search.trim()}%`);
    }

    if (sort !== undefined) {
      const direction = String(sort).toLowerCase();

      if (direction !== "asc" && direction !== "desc") {
        return res
          .status(400)
          .json({ error: "Sort måste vara asc eller desc" });
      }

      // Riktningen sätts in direkt i SQL:en eftersom ? bara fungerar för värden,
      // inte för nyckelord. Bara asc och desc kommer förbi kontrollen ovan.
      sql += ` ORDER BY p.price ${direction.toUpperCase()}`;
    } else {
      sql += " ORDER BY p.id";
    }

    const [products] = await pool.query<Product[]>(sql, params);

    res.status(200).json(await addCategories(products));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

// Hämtar en enskild produkt
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "Id måste vara ett positivt heltal" });
    }

    const [products] = await pool.query<Product[]>(
      `SELECT ${PRODUCT_FIELDS} FROM products p WHERE p.id = ?`,
      [id],
    );

    if (products.length === 0) {
      return res
        .status(404)
        .json({ error: `Hittade ingen produkt med id ${id}` });
    }

    const [product] = await addCategories(products);

    res.status(200).json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

// Skapar en ny produkt. title, description, stock och price är obligatoriska.
// image och categories är valfria.
router.post("/", async (req: Request, res: Response) => {
  let connection;

  try {
    const errors = validateProduct(req.body, false);

    if (errors.length > 0) {
      return res.status(400).json({ error: "Valideringsfel", details: errors });
    }

    const {
      title,
      description,
      stock,
      price,
      image = null,
      categories = [],
    } = req.body;

    // Transaktion så att produkten och kopplingarna sparas ihop.
    // Går något fel ångras allt med rollback.
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const missing = await findMissingCategories(connection, categories);

    if (missing.length > 0) {
      await connection.rollback();
      return res.status(400).json({
        error: "Valideringsfel",
        details: [`Dessa kategori-id finns inte: ${missing.join(", ")}`],
      });
    }

    const [result] = await connection.query<ResultSetHeader>(
      "INSERT INTO products (title, description, stock, price, image) VALUES (?, ?, ?, ?, ?)",
      [title.trim(), description.trim(), Number(stock), Number(price), image],
    );

    if (categories.length > 0) {
      await connection.query(
        "INSERT INTO product_categories (product_id, category_id) VALUES ?",
        [
          categories.map((categoryId: number) => [
            result.insertId,
            Number(categoryId),
          ]),
        ],
      );
    }

    await connection.commit();

    // Hämtar tillbaka produkten så att svaret innehåller id och created_date från databasen
    const [products] = await pool.query<Product[]>(
      `SELECT ${PRODUCT_FIELDS} FROM products p WHERE p.id = ?`,
      [result.insertId],
    );
    const [product] = await addCategories(products);

    res.status(201).json(product);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  } finally {
    if (connection) connection.release();
  }
});

// Uppdaterar en produkt. Bara fälten som skickas med ändras.
router.patch("/:id", async (req: Request, res: Response) => {
  let connection;

  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "Id måste vara ett positivt heltal" });
    }

    const errors = validateProduct(req.body, true);

    if (errors.length > 0) {
      return res.status(400).json({ error: "Valideringsfel", details: errors });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [existing] = await connection.query<IdRow[]>(
      "SELECT id FROM products WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      await connection.rollback();
      return res
        .status(404)
        .json({ error: `Hittade ingen produkt med id ${id}` });
    }

    const body = req.body;
    const has = (field: string) =>
      Object.prototype.hasOwnProperty.call(body, field);

    // Bygger UPDATE-satsen av de fält som faktiskt skickades med
    const updates: string[] = [];
    const params: unknown[] = [];

    if (has("title")) {
      updates.push("title = ?");
      params.push(body.title.trim());
    }
    if (has("description")) {
      updates.push("description = ?");
      params.push(body.description.trim());
    }
    if (has("stock")) {
      updates.push("stock = ?");
      params.push(Number(body.stock));
    }
    if (has("price")) {
      updates.push("price = ?");
      params.push(Number(body.price));
    }
    if (has("image")) {
      updates.push("image = ?");
      params.push(body.image);
    }

    if (updates.length > 0) {
      params.push(id);
      await connection.query(
        `UPDATE products SET ${updates.join(", ")} WHERE id = ?`,
        params,
      );
    }

    // Skickas categories med byts produktens kategorier ut helt
    if (has("categories")) {
      const missing = await findMissingCategories(connection, body.categories);

      if (missing.length > 0) {
        await connection.rollback();
        return res.status(400).json({
          error: "Valideringsfel",
          details: [`Dessa kategori-id finns inte: ${missing.join(", ")}`],
        });
      }

      await connection.query(
        "DELETE FROM product_categories WHERE product_id = ?",
        [id],
      );

      if (body.categories.length > 0) {
        await connection.query(
          "INSERT INTO product_categories (product_id, category_id) VALUES ?",
          [
            body.categories.map((categoryId: number) => [
              id,
              Number(categoryId),
            ]),
          ],
        );
      }
    }

    await connection.commit();

    const [products] = await pool.query<Product[]>(
      `SELECT ${PRODUCT_FIELDS} FROM products p WHERE p.id = ?`,
      [id],
    );
    const [product] = await addCategories(products);

    res.status(200).json(product);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  } finally {
    if (connection) connection.release();
  }
});

// Raderar en produkt
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "Id måste vara ett positivt heltal" });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM products WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: `Hittade ingen produkt med id ${id}` });
    }

    res.status(200).json({ message: `Produkt med id ${id} är raderad` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

export default router;
