const path    = require('path');
const fs      = require('fs');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const csv     = require('csv-parser');
const { Sequelize, DataTypes, Op } = require('sequelize');
const { Parser } = require('json2csv');

const app = express();
app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// --- Configuração do SQLite via Sequelize ---
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

// --- Modelos ---
const Category = sequelize.define('Category', {
  name: { type: DataTypes.STRING, unique: true }
});
const Transaction = sequelize.define('Transaction', {
  date:        DataTypes.STRING,   // armazenamos como texto "AAAA-MM-DD"
  history:     DataTypes.STRING,
  description: DataTypes.STRING,
  value:       DataTypes.FLOAT,
  balance:     DataTypes.FLOAT
});
const Budget = sequelize.define('Budget', {
  month:  DataTypes.STRING,   // ex: "2025-04"
  amount: DataTypes.FLOAT
});

// --- Associações ---
Category.hasMany(Transaction);
Transaction.belongsTo(Category);
Category.hasOne(Budget);
Budget.belongsTo(Category);

// --- Sincroniza e limpa (apagar este bloco após o primeiro run, se quiser) ---
(async () => {
  await sequelize.sync();
  console.log('✅ Database sincronizado');
})();

// --- Rotas de páginas ---
app.get('/',              (_, res) => res.render('index'));
app.get('/transactions-page', (_, res) => res.render('transactions'));
app.get('/categories-page',   (_, res) => res.render('categories'));
app.get('/budgets-page',      (_, res) => res.render('budgets'));
app.get('/dashboard-page',    (_, res) => res.render('dashboard'));

// --- API: Categories ---
app.get('/categories', async (_, res) => {
  res.json(await Category.findAll());
});
app.post('/categories', async (req, res) => {
  const cat = await Category.create({ name: req.body.name });
  res.json(cat);
});
// EDITAR categoria
app.put('/categories/:id', async (req, res) => {
  const cat = await Category.findByPk(req.params.id);
  if (!cat) return res.sendStatus(404);
  await cat.update({ name: req.body.name });
  res.json(cat);
});

// EXCLUIR categoria
app.delete('/categories/:id', async (req, res) => {
  await Category.destroy({ where: { id: req.params.id } });
  res.sendStatus(204);
});

// --- API: Budgets ---
app.get('/budgets', async (_, res) => {
  res.json(await Budget.findAll({ include: Category }));
});
app.post('/budgets', async (req, res) => {
  const b = await Budget.create(req.body);
  res.json(b);
});
app.delete('/budgets/:id', async (req, res) => {
  await Budget.destroy({ where: { id: req.params.id } });
  res.sendStatus(204);
});

// --- API: Transactions ---
app.get('/transactions', async (req, res) => {
  const where = {};
  if (req.query.month) {
    where.date = { [Op.like]: `${req.query.month}%` };
  }
  if (req.query.CategoryId) {
    where.CategoryId = req.query.CategoryId;
  }
  if (req.query.description) {
    where.description = { [Op.substring]: req.query.description };
  }
  if (req.query.date) {
    where.date = req.query.date;
  }
  const txs = await Transaction.findAll({ where, include: Category, order: [['date', 'DESC']] });
  res.json(txs);
});
app.post('/transactions', async (req, res) => {
  const tx = await Transaction.create(req.body);
  res.json(tx);
});
app.put('/transactions/:id', async (req, res) => {
  const tx = await Transaction.findByPk(req.params.id);
  await tx.update(req.body);
  res.json(tx);
});
app.delete('/transactions/:id', async (req, res) => {
  await Transaction.destroy({ where: { id: req.params.id } });
  res.sendStatus(204);
});

// --- Importação CSV Inter (retorna só os dados lidos) ---
const upload = multer({ dest: 'uploads/' });
app.post('/import/inter', upload.single('file'), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv({ separator: ';', skipLines: 5 }))
    .on('data', row => {
      if (!row['Data Lançamento']) return;
      const parts = row['Data Lançamento'].split('/');
      if (parts.length !== 3) return;
      results.push({
        date:        `${parts[2]}-${parts[1]}-${parts[0]}`,
        history:     (row['Histórico']   || '').trim(),
        description: (row['Descrição']   || '').trim(),
        value:       parseFloat((row['Valor']   || '0').replace(',', '.')),
        balance:     parseFloat((row['Saldo']   || '0').replace(',', '.'))
      });
    })
    .on('end', () => {
      fs.unlinkSync(req.file.path);
      res.json(results);
    })
    .on('error', err => {
      console.error('Erro ao ler CSV:', err);
      res.status(400).json({ error: 'Formato de CSV inválido' });
    });
});

// --- Exportar todas transações para CSV ---
app.get('/export/csv', async (req, res) => {
  const txs = await Transaction.findAll({ include: Category, order: [['date', 'ASC']] });
  const data = txs.map(tx => ({
    date:        tx.date,
    history:     tx.history,
    description: tx.description,
    value:       tx.value,
    balance:     tx.balance,
    category:    tx.Category?.name || ''
  }));
  const parser = new Parser({ fields: ['date','history','description','value','balance','category'] });
  const csv    = parser.parse(data);
  res.header('Content-Type','text/csv');
  res.attachment('transacoes_geral.csv');
  res.send(csv);
});

// --- Inicia servidor ---
const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Backend em http://localhost:${PORT}`));
