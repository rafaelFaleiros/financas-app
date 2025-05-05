const path    = require('path');
const fs      = require('fs');
const express = require('express');
const cors    = require('cors');
const multer  = require('multer');
const csv     = require('csv-parser');
const { Sequelize, DataTypes, Op } = require('sequelize');
const { Parser } = require('json2csv');  // novo para export CSV

const app = express();
app.use(cors());
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Configurando SQLite via Sequelize
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false,
});

// Definição de modelos
const Category = sequelize.define('Category', {
  name: { type: DataTypes.STRING, unique: true }
});
const Transaction = sequelize.define('Transaction', {
      // vamos armazenar a data como string "AAAA-MM-DD"
  date:        DataTypes.STRING,
  history:     DataTypes.STRING,
  description: DataTypes.STRING,
  value:       DataTypes.FLOAT,
  balance:     DataTypes.FLOAT
});
const Budget = sequelize.define('Budget', {
  month:  DataTypes.STRING,   // ex: "2025-04"
  amount: DataTypes.FLOAT
});

// Relações
Category.hasMany(Transaction);
Transaction.belongsTo(Category);
Category.hasOne(Budget);
Budget.belongsTo(Category);

// Sincroniza o banco
(async () => {
  await sequelize.sync();
  console.log('✅ Database sincronizado');
})();

// Rota da página principal
app.get('/', (req, res) => {
  res.render('index');
});

// CRUD Categories
app.get('/categories', async (_, res) => {
  res.json(await Category.findAll());
});
app.post('/categories', async (req, res) => {
  const cat = await Category.create({ name: req.body.name });
  res.json(cat);
});

// CRUD Budgets
app.get('/budgets', async (_, res) => {
  res.json(await Budget.findAll());
});
app.post('/budgets', async (req, res) => {
  const b = await Budget.create(req.body);
  res.json(b);
});

// CRUD Transactions
app.get('/transactions', async (req, res) => {
  const where = {};
  if (req.query.month) {
    where.date = { [Op.like]: `${req.query.month}%` };
  }
  const txs = await Transaction.findAll({ where, include: Category });
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
// Excluir orçamento
app.delete('/budgets/:id', async (req, res) => {
    await Budget.destroy({ where: { id: req.params.id } });
    res.sendStatus(204);
  });
  
// Importação CSV Inter
const upload = multer({ dest: 'uploads/' });
// Remova ou comente a versão anterior de /import/inter
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
        // retorna só os dados, sem inserir
        res.json(results);
      })
      .on('error', err => {
        console.error('Erro ao ler CSV:', err);
        res.status(400).json({ error: 'Formato de CSV inválido' });
      });
  });
  
  
  app.get('/export/csv', async (req, res) => {
    const txs = await Transaction.findAll({ include: Category, order: [['date','ASC']] });
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
  
  // ROTA CATEGORIES PAGE
  app.get('/categories-page', (_, res) => res.render('categories'));
  
  // ROTA BUDGETS PAGE
  app.get('/budgets-page', (_, res) => res.render('budgets'));
  
  // ROTA DASHBOARD PAGE
  app.get('/dashboard-page', (_, res) => res.render('dashboard'));
  

// Inicia servidor
const PORT = 3001;
app.listen(PORT, () => console.log(`🚀 Backend em http://localhost:${PORT}`));
