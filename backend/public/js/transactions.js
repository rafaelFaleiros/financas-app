$(async ()=>{
    const API = 'http://localhost:3001';
    // popula filtro de categoria
    const cats = await fetch(API+'/categories').then(r=>r.json());
    cats.forEach(c=>$('#filtroCat').append(`<option value="${c.id}">${c.name}</option>`));
  
    // função de listar
    async function list(filter={}){
      let url = new URL(API+'/transactions');
      Object.keys(filter).forEach(k=>filter[k] && url.searchParams.append(k,filter[k]));
      const txs = await fetch(url).then(r=>r.json());
      const $b = $('#allTxTable tbody').empty();
      txs.forEach(tx=>{
        const cat = cats.find(c=>c.id===tx.CategoryId)?.name||'';
  
        $b.append(`
          <tr>
            <td>${tx.date}</td><td>${tx.history}</td><td>${tx.description}</td>
            <td>${tx.value.toFixed(2)}</td><td>${tx.balance.toFixed(2)}</td><td>${cat}</td>
            <td><button class="del" data-id="${tx.id}">❌</button></td>
          </tr>
        `);
      });
    }
  
    // filtro
    $('#btnFilter').click(()=>{
      list({
        description: $('#filtroDesc').val(),
        CategoryId:  $('#filtroCat').val(),
        date:        $('#filtroData').val()
      });
    });
  
    // excluir direto
    $('#allTxTable').on('click','.del',async function(){
      await fetch(API+`/transactions/${$(this).data('id')}`,{method:'DELETE'});
      list({});
    });
  
    // inicial
    list({});
  });
  