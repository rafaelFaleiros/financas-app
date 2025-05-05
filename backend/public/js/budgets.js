$(async ()=>{
    const API='http://localhost:3001';
    const cats = await fetch(API+'/categories').then(r=>r.json());
    cats.forEach(c=>$('#selCat').append(`<option value="${c.id}">${c.name}</option>`));
  
    async function loadB(){
      const buds = await fetch(API+'/budgets').then(r=>r.json());
      $('#budList').empty();
      buds.forEach(b=>{
        const cat = cats.find(x=>x.id===b.CategoryId)?.name||'';
        $('#budList').append(`
          <li>${b.month} • ${cat} = R$${b.amount.toFixed(2)}
            <button class="delB" data-id="${b.id}">❌</button>
          </li>`);
      });
    }
  
    $('#btnAddBud').click(async ()=>{
      await fetch(API+'/budgets',{method:'POST',headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ CategoryId:$('#selCat').val(), month:$('#inpMonth').val(), amount:parseFloat($('#inpAmount').val()) })
      });
      loadB();
    });
  
    $('#budList').on('click','.delB',async function(){
      await fetch(API+`/budgets/${$(this).data('id')}`,{method:'DELETE'});
      loadB();
    });
  
    loadB();
  });
  