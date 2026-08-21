import mysql from "mysql2/promise";
import dotenv from "dotenv";

// Läser in .env så att inloggningsuppgifterna hamnar i process.env
dotenv.config();

// Anslutningen till databasen. Skapas en gång och återanvänds av hela API:et.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4", // så att å, ä och ö sparas rätt
  dateStrings: true, // datum som text istället för Date-objekt
  decimalNumbers: true, // pris som tal istället för text
});

export default pool;
