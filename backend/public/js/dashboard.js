$(async () => {
    const API = 'http://localhost:3001';
  
    // Preenche mês/ano e categorias
    const selMonth = $('#selMonth');
    const hoje = new Date().toISOString().slice(0,7);
    selMonth.val(hoje);
    const cats = await fetch(API + '/categories').then(r => r.json());
    cats.forEach(c => $('#newCat').append(`<option value="${c.id}">${c.name}</option>`));
    selMonth.on('change', loadDashboard);
  
    // Adicionar transação
    $('#btnAddTx').click(async () => {
      const tx = {
        date:        $('#newDate').val(),
        history:     $('#newHistory').val(),
        description: $('#newDesc').val(),
        value:       parseFloat($('#newValue').val()),
        balance:     0,
        CategoryId:  $('#newCat').val() || null
      };
      await fetch(API + '/transactions', {
        method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(tx)
      });
      $('#newDate,#newHistory,#newDesc,#newValue').val('');
      $('#newCat').val('');
      loadDashboard();
    });
  
    async function loadDashboard() {
      const month = selMonth.val();
      const [txs, buds] = await Promise.all([
        fetch(`${API}/transactions?month=${month}`).then(r => r.json()),
        fetch(API + '/budgets').then(r => r.json())
      ]);
  
      // 1) Entradas e saídas
      const entradas = txs.filter(t => t.value > 0).reduce((sum, t) => sum + t.value, 0);
      const saidas   = txs.filter(t => t.value < 0).reduce((sum, t) => sum + Math.abs(t.value), 0);
      const guardado = entradas - saidas;
      $('#totalSpent').text(`R$ ${saidas.toFixed(2)}`);
      $('#totalSaved').text(`R$ ${guardado.toFixed(2)}`);
  
      // 2) Gauges por categoria
      const container = $('#gaugesContainer').empty();
      cats.forEach(cat => {
        // orçamento e gasto desta categoria no mês
        const bud = buds.find(b => b.CategoryId === cat.id && b.month === month);
        const budget = bud ? bud.amount : 0;
        const spent = txs
          .filter(t => t.CategoryId === cat.id && t.value < 0)
          .reduce((sum, t) => sum + Math.abs(t.value), 0);
  
        // calculamos remaining = budget - spent;
        const remaining = budget - spent;
  
        // Se budget e spent forem zero, não faz sentido gauge, pulamos
        if (budget === 0 && spent === 0) return;
  
        const id = `gauge-cat-${cat.id}`;
        container.append(`
          <div class="gauge-card">
            <h4>${cat.name}</h4>
            <div id="${id}"></div>
            <p>R$ ${spent.toFixed(2)} / R$ ${budget.toFixed(2)}</p>
          </div>
        `);
  
        // Determina min e max para o gauge, garantindo max > min
        const minVal = Math.min(0, remaining);
        const maxVal = Math.max(budget, spent, remaining);
  
        if (maxVal <= minVal) return; // evita gauge inválido
  
        new JustGage({
          id,
          value: Math.max(remaining, minVal),
          min:   minVal,
          max:   maxVal,
          donut: true,
          gaugeWidthScale: 0.6,
          pointer: true,
          showInnerShadow: false,
          valueFontColor: '#fff',
          gaugeColor: '#333',
          levelColors: [
            remaining < 0 ? '#e53935' : '#43a047'
          ]
        });
      });
    }
  
    loadDashboard();
  });
  