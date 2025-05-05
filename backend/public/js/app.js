$(()=> {
  const API = 'http://localhost:3001';
  let pending = [];

  // 1) Importar e abrir modal
  $('#btnImport').click(async () => {
    const f = $('#csvFile')[0].files[0];
    if (!f) return alert('Selecione um arquivo!');
    const form = new FormData(); form.append('file', f);
    pending = await fetch(`${API}/import/inter`, {method:'POST',body:form}).then(r=>r.json());
    renderModal();
    $('#importModal').show();
  });

  // 2) Renderiza linhas pendentes no modal
  function renderModal(){
    const $b = $('#modalTable tbody').empty();
    pending.forEach((tx,i) => {
      const tr = $('<tr>');
      tr.append(`<td>${tx.date}</td>`);
      tr.append(`<td>${tx.history}</td>`);
      tr.append(`<td contenteditable class="edit" data-i="${i}" data-f="description">${tx.description}</td>`);
      tr.append(`<td contenteditable class="edit" data-i="${i}" data-f="value">${tx.value}</td>`);
      tr.append(`<td>${tx.balance}</td>`);
      const sel = $(`<select data-i="${i}"><option value="">—</option></select>`);
      tr.append($('<td>').append(sel));
      tr.append(`
        <td>
          <button class="saveOne" data-i="${i}">Salvar</button>
          <button class="delOne"  data-i="${i}">Excluir</button>
        </td>`);
      $b.append(tr);
    });
    // popula categorias no select
    fetch(API+'/categories').then(r=>r.json()).then(c=> {
      $('select[data-i]').each((_,sel)=> 
        c.forEach(x=>$(sel).append(`<option value="${x.id}">${x.name}</option>`))
      );
    });
  }

  // 3) Salvar 1 linha
  $('#modalTable').on('click','.saveOne',async function(){
    const i = $(this).data('i');
    const tx = pending[i];
    // pega edições
    const tr = $(this).closest('tr');
    tx.description = tr.find('.edit[data-f="description"]').text();
    tx.value       = parseFloat(tr.find('.edit[data-f="value"]').text())||0;
    tx.CategoryId  = tr.find('select').val()||null;
    // salva
    await fetch(API+'/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tx)});
    pending.splice(i,1);
    renderModal();
  });

  // 4) Excluir 1 linha pendente
  $('#modalTable').on('click','.delOne',function(){
    pending.splice($(this).data('i'),1);
    renderModal();
  });

  // 5) Salvar tudo
  $('#btnSaveAll').click(async () => {
    for (let tx of pending) {
      await fetch(API+'/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tx)});
    }
    pending = [];
    renderModal();
  });

  // Fechar modal
  $('#btnCloseModal').click(()=>$('#importModal').hide());
});
