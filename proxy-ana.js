// Proxy ANA/Hidroweb para contornar CORS
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());

// Endpoint para buscar estações do RS
app.get('/hidroweb/estacoes', async (req, res) => {
  try {
    // Endpoint público da ANA/Hidroweb
    const url = 'https://www.snirh.gov.br/hidrowebservices/api/estacoes?uf=RS';
    const response = await fetch(url);
    const contentType = response.headers.get('content-type');
    if (!response.ok) throw new Error('Erro ao buscar dados da ANA');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      res.json(data);
    } else {
      // Se vier HTML, retorna erro
      const text = await response.text();
      res.status(502).json({ error: 'Resposta não é JSON', details: text });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy ANA rodando em http://localhost:${PORT}`);
});
