$(document).ready(() => {
    const API = 'http://localhost:3001';
    let pending = [];  // armazena as linhas importadas
  
    // 1) Exibir transações já salvas
    async function loadTransactions() {
      const [txRes, catRes] = await Promise.all([
        fetch(`${API}/transactions`).then(r => r.json()),
        fetch(`${API}/categories`).then(r => r.json())
      ]);
      const $tb = $('#txTable tbody').empty();
      txRes.forEach(tx => {
        const tr = $('<tr>');
        tr.append(`<td>${tx.date}</td>`);
        tr.append(`<td>${tx.history}</td>`);
        tr.append(`<td>${tx.description}</td>`);
        tr.append(`<td>${tx.value.toFixed(2)}</td>`);
        tr.append(`<td>${tx.balance.toFixed(2)}</td>`);
        tr.append(`<td>${tx.Category?.name||''}</td>`);
        $tb.append(tr);
      });
    }
  
    // 2) Preencher “pending” na tabela de importação
    function renderPending() {
      const $tb = $('#txTable tbody').empty();
      pending.forEach((tx, idx) => {
        const tr = $('<tr>');
        tr.append(`<td>${tx.date}</td>`);
        tr.append(`<td>${tx.history}</td>`);
        tr.append(`<td contenteditable class="edit" data-idx="${idx}" data-field="description">${tx.description}</td>`);
        tr.append(`<td contenteditable class="edit" data-idx="${idx}" data-field="value">${tx.value}</td>`);
        tr.append(`<td>${tx.balance}</td>`);
        tr.append(`<td class="category-cell">
          <select class="selCat" data-idx="${idx}">
            <option value="">— sem categoria —</option>
          </select>
        </td>`);
        tr.append(`<td>
          <button class="btnSave" data-idx="${idx}">Salvar</button>
          <button class="btnDel" data-idx="${idx}">Excluir</button>
        </td>`);
        $tb.append(tr);
      });
      // preencher dropdowns de categoria
      fetch(`${API}/categories`).then(r=>r.json()).then(cats=>{
        $('.selCat').each((_,sel)=>{
          cats.forEach(c=>$(sel).append(`<option value="${c.id}">${c.name}</option>`));
        });
      });
    }
  
    // 3) Importar CSV (popula pending)
    $('#btnImport').click(async () => {
      const file = $('#csvFile')[0].files[0];
      if (!file) return alert('Selecione um arquivo!');
      const form = new FormData(); form.append('file', file);
      try {
        pending = await fetch(`${API}/import/inter`, { method: 'POST', body: form }).then(r=>r.json());
        $('#importMsg').text(`Importadas ${pending.length} linhas. Edite e salve.`);
        renderPending();
      } catch {
        $('#importMsg').text('Erro ao importar.');
      }
    });
  
    // 4) Salvar uma linha
    $('#txTable').on('click', '.btnSave', async function(){
      const i = $(this).data('idx');
      const tx = pending[i];
      // pegar possíveis edits
      const tr = $(this).closest('tr');
      tx.description = tr.find('.edit[data-field="description"]').text();
      tx.value       = parseFloat(tr.find('.edit[data-field="value"]').text());
      tx.CategoryId  = tr.find('.selCat').val() || null;
      // salva no backend
      await fetch(`${API}/transactions`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(tx)
      });
      // remove do array e re-render
      pending.splice(i,1);
      renderPending();
      loadChart();  // atualiza gráfico
    });
  
    // 5) Excluir uma linha pendente
    $('#txTable').on('click', '.btnDel', function(){
      pending.splice($(this).data('idx'),1);
      renderPending();
    });
  
    // 6) Salvar tudo
    $('#btnSaveAll').click(async () => {
      for (let tx of pending) {
        await fetch(`${API}/transactions`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(tx)
        });
      }
      pending = [];
      renderPending();
      loadChart();
    });
  
    // 7) Orçamentos: recarregar a lista após salvar/excluir
    async function loadBudgets() {
      const buds = await fetch(`${API}/budgets`).then(r=>r.json());
      const $ul  = $('#budList').empty();
      buds.forEach(b=>{
        $ul.append(`<li>${b.month} • ${b.Category?.name||''} = R$${b.amount.toFixed(2)}
          <button class="delBud" data-id="${b.id}">❌</button></li>`);
      });
    }
    $('#btnAddBud').click(async () => {
      const catId = $('#selCat').val();
      const month = $('#inpMonth').val();
      const amt   = parseFloat($('#inpAmount').val());
      await fetch(`${API}/budgets`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ CategoryId: catId, month, amount: amt })
      });
      loadBudgets();
    });
    $('#budList').on('click','.delBud', async function(){
      await fetch(`${API}/budgets/${$(this).data('id')}`,{ method:'DELETE' });
      loadBudgets();
    });
  
    // 8) Montar dashboard
    async function loadChart() {
      const month = new Date().toISOString().slice(0,7);
      const [txs, buds, cats] = await Promise.all([
        fetch(`${API}/transactions?month=${month}`).then(r=>r.json()),
        fetch(`${API}/budgets`).then(r=>r.json()),
        fetch(`${API}/categories`).then(r=>r.json())
      ]);
      const sums = {};
      txs.forEach(tx => {
        const n = cats.find(c=>c.id===tx.CategoryId)?.name||'Sem categoria';
        sums[n] = (sums[n]||0) + tx.value;
      });
      const labels = Object.keys(sums);
      const data = {
        labels,
        datasets: [
          { label: `Gastos ${month}`, data: labels.map(l=>sums[l]) },
          { label: 'Orçamento',       data: labels.map(l=>{
              const c = cats.find(x=>x.name===l);
              const b = buds.find(x=>x.CategoryId===c?.id);
              return b?b.amount:0;
          }) }
        ]
      };
      // gráfico
      if (window.bc) window.bc.destroy();
      const ctx = document.getElementById('barChart').getContext('2d');
      window.bc = new Chart(ctx, { type:'bar', data, options:{ scales:{ y:{ beginAtZero:true } } } });
    }
  
    // 9) Inicialização
    (async () => {
      // popula drop de categorias no orçamento
      const cats = await fetch(`${API}/categories`).then(r=>r.json());
      $('#selCat').empty().append('<option value="">—</option>');
      cats.forEach(c=>$('#selCat').append(`<option value="${c.id}">${c.name}</option>`));
      loadBudgets();
      loadTransactions();
      loadChart();
    })();
  });
  