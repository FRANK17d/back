import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    message: 'API funcionando con Express y TypeScript',
  });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});