import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());

app.get("/", (_, res) => {
    res.send("Billplz Simulator");
});

const PORT = process.env.PORT || 4400;

app.listen(PORT, () => {
    console.log(`Running on ${PORT}`);
});