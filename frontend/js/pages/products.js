import { api } from '../api.js';
import { initShopLayout } from '../layout.js';
import {
  escapeHTML, renderProductCard, renderProductSkeletons,
  renderErrorState, renderEmptyState, renderPagination, focusResults, showToast,
} from '../ui.js';
import { addToCart } from '../cart-store.js';

let currentUser = null;
let categoriesCache = [];

function getParamsFromURL() {
  const sp = new URLSearchParams(window.location.search);
  return {
    q: sp.get('q') || '',
    category: sp.get('category') || '',
    roast: sp.get('roast') || '',
    origin: sp.get('origin') || '',
    minPrice: sp.get('minPrice') || '',
    maxPrice: sp.get('maxPrice') || '',
    inStock: sp.get('inStock') === '1',
    sort: sp.get('sort') || 'newest',
    page: Math.max(1, parseInt(sp.get('page'), 10) || 1),
  };
}

function pushParamsToURL(params) {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.category) sp.set('category', params.category);
  if (params.roast) sp.set('roast', params.roast);
  if (params.origin) sp.set('origin', params.origin);
  if (params.minPrice) sp.set('minPrice', params.minPrice);
  if (params.maxPrice) sp.set('maxPrice', params.maxPrice);
  if (params.inStock) sp.set('inStock', '1');
  if (params.sort && params.sort !== 'newest') sp.set('sort', params.sort);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  const nextUrl = qs ? `/products.html?${qs}` : '/products.html';
  window.history.pushState({}, '', nextUrl);
}

function syncFormWithParams(p) {
  document.getElementById('filter-q').value = p.q;
  document.getElementById('filter-origin').value = p.origin;
  document.getElementById('filter-min-price').value = p.minPrice;
  document.getElementById('filter-max-price').value = p.maxPrice;
  document.getElementById('filter-instock').checked = p.inStock;
  document.getElementById('shop-sort').value = p.sort;

  document.querySelectorAll('input[name="category"]').forEach((r) => { r.checked = r.value === p.category; });
  document.querySelectorAll('input[name="roast"]').forEach((r) => { r.checked = r.value === p.roast; });

  // Chi hien loc muc rang khi xem tat ca hoac nhom ca phe
  const showRoast = !p.category || p.category === 'ca-phe-rang' || p.category === 'drip-bag-hoa-tan';
  document.getElementById('filter-roast-group').classList.toggle('hidden', !showRoast);

  const heading = document.getElementById('shop-heading');
  const catObj = categoriesCache.find((c) => c.slug === p.category);
  if (p.q) heading.textContent = `Kết quả tìm kiếm: “${p.q}”`;
  else if (catObj) heading.textContent = catObj.name;
  else heading.textContent = 'Tất cả sản phẩm';
}

function readParamsFromForm() {
  const cat = document.querySelector('input[name="category"]:checked')?.value || '';
  const roast = document.querySelector('input[name="roast"]:checked')?.value || '';
  return {
    q: document.getElementById('filter-q').value.trim(),
    category: cat,
    roast: (!cat || cat === 'ca-phe-rang' || cat === 'drip-bag-hoa-tan') ? roast : '',
    origin: document.getElementById('filter-origin').value,
    minPrice: document.getElementById('filter-min-price').value.trim(),
    maxPrice: document.getElementById('filter-max-price').value.trim(),
    inStock: document.getElementById('filter-instock').checked,
    sort: document.getElementById('shop-sort').value,
    page: 1,
  };
}

async function fetchAndRenderProducts() {
  const params = getParamsFromURL();
  syncFormWithParams(params);

  const grid = document.getElementById('shop-grid');
  const pag = document.getElementById('shop-pagination');
  const countEl = document.getElementById('shop-count');

  grid.innerHTML = renderProductSkeletons(8);
  pag.innerHTML = '';

  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v !== false && v !== null && v !== undefined) {
      qs.set(k, v === true ? '1' : String(v));
    }
  });
  qs.set('pageSize', '8');

  try {
    const data = await api.get(`/api/products?${qs.toString()}`);
    countEl.textContent = `Hiển thị ${data.items.length} / ${data.total} sản phẩm`;

    if (data.items.length === 0) {
      grid.style.display = 'block';
      grid.innerHTML = renderEmptyState(
        'Không tìm thấy sản phẩm phù hợp',
        'Thử bỏ bớt một vài tiêu chí lọc hoặc tìm bằng từ khóa ngắn hơn.',
        '/products.html',
        'Xem tất cả sản phẩm'
      );
      return;
    }

    grid.style.display = '';
    grid.innerHTML = data.items.map(renderProductCard).join('');
    pag.innerHTML = renderPagination(data.page, data.totalPages);
  } catch (err) {
    grid.style.display = 'block';
    grid.innerHTML = renderErrorState(err.message, 'retry-shop');
    document.getElementById('retry-shop')?.addEventListener('click', fetchAndRenderProducts);
  }
}

async function loadFilterOptions() {
  const [cats, meta] = await Promise.all([api.get('/api/categories'), api.get('/api/products/meta')]);
  categoriesCache = cats;

  const catHost = document.getElementById('filter-categories');
  catHost.innerHTML = `
    <label class="filter-option"><input type="radio" name="category" value=""> Tất cả danh mục</label>
    ${cats.map((c) => `
      <label class="filter-option">
        <input type="radio" name="category" value="${escapeHTML(c.slug)}">
        <span>${escapeHTML(c.name)} <small class="text-soft">(${Number(c.product_count)})</small></span>
      </label>
    `).join('')}
  `;

  const originSelect = document.getElementById('filter-origin');
  meta.origins.forEach((orig) => {
    const opt = document.createElement('option');
    opt.value = orig;
    opt.textContent = orig;
    originSelect.appendChild(opt);
  });
}

function bindEvents() {
  const sidebar = document.getElementById('filter-sidebar');
  document.getElementById('open-filter-btn').addEventListener('click', () => sidebar.classList.add('open'));
  document.getElementById('close-filter-btn').addEventListener('click', () => sidebar.classList.remove('open'));

  document.querySelectorAll('input[name="pricePreset"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const [minP, maxP] = radio.value ? radio.value.split('-') : ['', ''];
      document.getElementById('filter-min-price').value = minP || '';
      document.getElementById('filter-max-price').value = maxP || '';
    });
  });

  document.getElementById('apply-filter-btn').addEventListener('click', () => {
    pushParamsToURL(readParamsFromForm());
    sidebar.classList.remove('open');
    fetchAndRenderProducts();
  });

  document.getElementById('clear-filter-btn').addEventListener('click', () => {
    pushParamsToURL({ q: '', category: '', roast: '', origin: '', minPrice: '', maxPrice: '', inStock: false, sort: 'newest', page: 1 });
    document.querySelectorAll('input[name="pricePreset"]').forEach((r) => { r.checked = r.value === ''; });
    sidebar.classList.remove('open');
    fetchAndRenderProducts();
  });

  document.getElementById('shop-sort').addEventListener('change', () => {
    const params = getParamsFromURL();
    params.sort = document.getElementById('shop-sort').value;
    params.page = 1;
    pushParamsToURL(params);
    fetchAndRenderProducts();
  });

  document.getElementById('shop-pagination').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    const params = getParamsFromURL();
    params.page = Number(btn.getAttribute('data-page'));
    pushParamsToURL(params);
    await fetchAndRenderProducts();
    focusResults(document.getElementById('shop-count'));
  });

  document.getElementById('shop-grid').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-quick-add]');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    try {
      await addToCart(currentUser, btn.getAttribute('data-quick-add'), 1);
      showToast('Đã thêm sản phẩm vào giỏ hàng.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  window.addEventListener('popstate', fetchAndRenderProducts);
}

(async () => {
  const auth = await initShopLayout('shop');
  currentUser = auth.user;
  await loadFilterOptions();
  bindEvents();
  await fetchAndRenderProducts();
})();
