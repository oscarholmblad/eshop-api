import { Router, Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import pool from "../config/db";

const router = Router();

// Beskriver hur en rad ur tabellen ser ut, så att TypeScript vet vad queryn ger tillbaka
interface Category extends RowDataPacket {
  id: number;
  name: string;
}

interface Product extends RowDataPacket {
  id: number;
  title: string;
  description: string;
  stock: number;
  price: number;
  image: string | null;
  created_date: string;
}

// Hämtar alla kategorier
router.get("/", async (req: Request, res: Response) => {
  try {
    const [categories] = await pool.query<Category[]>(
      "SELECT id, name FROM categories ORDER BY name",
    );

    res.status(200).json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

// Hämtar alla produkter som tillhör en kategori
router.get("/:id/products", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "Id måste vara ett positivt heltal" });
    }

    // Kollar först att kategorin finns, annars går det inte att skilja på
    // en tom kategori och en kategori som inte existerar
    const [categories] = await pool.query<Category[]>(
      "SELECT id FROM categories WHERE id = ?",
      [id],
    );

    if (categories.length === 0) {
      return res
        .status(404)
        .json({ error: `Hittade ingen kategori med id ${id}` });
    }

    const [products] = await pool.query<Product[]>(
      `SELECT p.id, p.title, p.description, p.stock, p.price, p.image, p.created_date
       FROM products p
       INNER JOIN product_categories pc ON pc.product_id = p.id
       WHERE pc.category_id = ?
       ORDER BY p.id`,
      [id],
    );

    res.status(200).json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

// Skapar en ny kategori
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Fältet name är obligatoriskt" });
    }

    const [existing] = await pool.query<Category[]>(
      "SELECT id FROM categories WHERE name = ?",
      [name.trim()],
    );

    if (existing.length > 0) {
      return res
        .status(409)
        .json({ error: "Det finns redan en kategori med det namnet" });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "INSERT INTO categories (name) VALUES (?)",
      [name.trim()],
    );

    res.status(201).json({ id: result.insertId, name: name.trim() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

// Uppdaterar en kategori
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;

    if (!Number.isInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "Id måste vara ett positivt heltal" });
    }

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({ error: "Fältet name är obligatoriskt" });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "UPDATE categories SET name = ? WHERE id = ?",
      [name.trim(), id],
    );

    // affectedRows är 0 om ingen rad matchade id
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: `Hittade ingen kategori med id ${id}` });
    }

    res.status(200).json({ id, name: name.trim() });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

// Raderar en kategori
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id < 1) {
      return res
        .status(400)
        .json({ error: "Id måste vara ett positivt heltal" });
    }

    const [result] = await pool.query<ResultSetHeader>(
      "DELETE FROM categories WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ error: `Hittade ingen kategori med id ${id}` });
    }

    res.status(200).json({ message: `Kategori med id ${id} är raderad` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Något gick fel på servern" });
  }
});

export default router;
