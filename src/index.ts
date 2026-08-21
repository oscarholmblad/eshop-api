import express, { Request, Response } from "express";
import cors from "cors";
import categoriesRouter from "./routes/categories";
import productsRouter from "./routes/products";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // gör att API:et går att anropa från en annan domän
app.use(express.json()); // gör att req.body går att läsa som JSON

app.use("/categories", categoriesRouter);
app.use("/products", productsRouter);

// Fångar upp anrop till endpoints som inte finns
app.use((req: Request, res: Response) => {
  res
    .status(404)
    .json({ error: `Endpointen ${req.method} ${req.originalUrl} finns inte` });
});

app.listen(PORT, () => {
  console.log(`Servern kör på http://localhost:${PORT}`);
});
