// server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');

async function readJSON(filename) {
  const file = path.join(DATA_DIR, filename);
  try {
    const raw = await fs.readFile(file, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(file, '[]', 'utf8');
      return [];
    }
    throw err;
  }
}

async function writeJSON(filename, data) {
  const file = path.join(DATA_DIR, filename);
  // write atomically by stringifying, overwritten each time (fine for small app)
  await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
}

// Generic endpoints factory
function makeRoutes(entityName, filename) {
  // GET all
  app.get(`/api/${entityName}`, async (req, res) => {
    try {
      const items = await readJSON(filename);
      res.json(items);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'read error' });
    }
  });

  // POST create
  app.post(`/api/${entityName}`, async (req, res) => {
    try {
      const items = await readJSON(filename);
      const newItem = req.body;
      if (!newItem.id) newItem.id = Date.now();
      items.push(newItem);
      await writeJSON(filename, items);
      res.status(201).json(newItem);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'write error' });
    }
  });

  // DELETE by id
  app.delete(`/api/${entityName}/:id`, async (req, res) => {
    try {
      const id = Number(req.params.id);
      let items = await readJSON(filename);
      const before = items.length;
      items = items.filter(it => Number(it.id) !== id);
      if (items.length === before) return res.status(404).json({ error: 'not found' });
      await writeJSON(filename, items);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'delete error' });
    }
  });

  // PUT update by id (simple replace/merge)
  app.put(`/api/${entityName}/:id`, async (req, res) => {
    try {
      const id = Number(req.params.id);
      let items = await readJSON(filename);
      const idx = items.findIndex(it => Number(it.id) === id);
      if (idx === -1) return res.status(404).json({ error: 'not found' });
      items[idx] = { ...items[idx], ...req.body, id: items[idx].id };
      await writeJSON(filename, items);
      res.json(items[idx]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'update error' });
    }
  });
}

// create routes for the 4 datasets
makeRoutes('bookings', 'bookings.json');
makeRoutes('doulas', 'doulas.json');
makeRoutes('services', 'services.json');
makeRoutes('paychecks', 'paychecks.json');

// convenience endpoint: get everything
app.get('/api/all', async (req, res) => {
  try {
    const bookings = await readJSON('bookings.json');
    const doulas = await readJSON('doulas.json');
    const services = await readJSON('services.json');
    const paychecks = await readJSON('paychecks.json');
    res.json({ bookings, doulas, services, paychecks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'read error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`JSON-backend listening on port ${PORT}`));
