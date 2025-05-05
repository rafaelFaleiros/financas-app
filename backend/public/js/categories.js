$(async () => {
    const API = 'http://localhost:3001';
  
    // 1) Função para carregar a lista de categorias
    async function loadCats() {
      const cats = await fetch(API + '/categories').then(r => r.json());
      const $ul = $('#catList').empty();
      cats.forEach(c => {
        const $li = $(`
          <li data-id="${c.id}">
            <input type="text" class="catName" value="${c.name}">
            <button class="btnSaveCat">Salvar</button>
            <button class="btnDelCat">Excluir</button>
          </li>
        `);
        $ul.append($li);
      });
    }
  
    // 2) Adicionar categoria
    $('#btnAddCat').click(async () => {
      const name = $('#newCatName').val().trim();
      if (!name) return alert('Digite um nome');
      await fetch(API + '/categories', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
      });
      $('#newCatName').val('');
      loadCats();
    });
  
    // 3) Salvar edição
    $('#catList').on('click', '.btnSaveCat', async function() {
      const $li = $(this).closest('li');
      const id   = $li.data('id');
      const name = $li.find('.catName').val().trim();
      if (!name) return alert('Nome não pode ficar vazio');
      await fetch(`${API}/categories/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
      });
      loadCats();
    });
  
    // 4) Excluir categoria
    $('#catList').on('click', '.btnDelCat', async function() {
      if (!confirm('Excluir esta categoria?')) return;
      const id = $(this).closest('li').data('id');
      await fetch(`${API}/categories/${id}`, { method: 'DELETE' });
      loadCats();
    });
  
    // Inicializa
    loadCats();
  });
  