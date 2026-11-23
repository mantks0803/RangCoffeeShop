import { api } from '../api.js';
import { initShopLayout } from '../layout.js';
import {
  escapeHTML, renderProductCard, renderProductSkeletons, renderPagination, focusResults,
  renderStars, renderErrorState, showToast, formatDate,
} from '../ui.js';
import { addToCart } from '../cart-store.js';

let currentUser = null;

async function loadHomeData() {
  const catEl = document.getElementById('home-categories');
  const featEl = document.getElementById('home-featured');
  const revEl = document.getElementById('home-reviews');

  catEl.innerHTML = Array.from({ length: 6 }).map(() => '<div class="skeleton" style="height:128px;"></div>').join('');
  featEl.innerHTML = renderProductSkeletons(4);
  revEl.innerHTML = Array.from({ length: 3 }).map(() => '<div class="skeleton" style="height:160px;"></div>').join('');

  try {
    const [categories, featured, reviews] = await Promise.all([
      api.get('/api/categories'),
      api.get('/api/products/featured'),
      api.get('/api/reviews/latest'),
    ]);

    catEl.innerHTML = categories.map((c) => `
      <a class="category-card" href="/products.html?category=${encodeURIComponent(c.slug)}">
        <div>
          <h3>${escapeHTML(c.name)}</h3>
          <p>${escapeHTML(c.description || '')}</p>
        </div>
        <span class="mono-label">${Number(c.product_count)} sản phẩm →</span>
      </a>
    `).join('');

    const pager = document.getElementById('featured-pages');
    const pageSize = 4;
    function showFeatured(page) {
      const start = (page - 1) * pageSize;
      featEl.innerHTML = featured.slice(start, start + pageSize).map(renderProductCard).join('');
      pager.innerHTML = renderPagination(page, Math.ceil(featured.length / pageSize));
    }
    showFeatured(1);
    pager.onclick = (event) => {
      const button = event.target.closest('button[data-page]');
      if (!button || button.disabled) return;
      showFeatured(Number(button.dataset.page));
      focusResults(featEl);
    };

    if (reviews.length === 0) {
      revEl.innerHTML = '<p class="text-soft">Chưa có đánh giá nào.</p>';
    } else {
      revEl.innerHTML = reviews.map((r) => `
        <article class="review-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            ${renderStars(r.rating, 14)}
            <span class="mono-label">${formatDate(r.createdAt)}</span>
          </div>
          <h3 style="font-size:1rem;margin:0;">${escapeHTML(r.title)}</h3>
          <p style="font-size:0.92rem;color:var(--ink-soft);margin:0;">“${escapeHTML(r.content)}”</p>
          <div style="margin-top:auto;padding-top:8px;border-top:1px solid var(--line);font-size:0.84rem;">
            <strong>${escapeHTML(r.authorName)}</strong> ·
            <a href="/product.html?slug=${encodeURIComponent(r.productSlug)}" style="text-decoration:underline;">${escapeHTML(r.productName)}</a>
          </div>
        </article>
      `).join('');
    }
  } catch (err) {
    catEl.innerHTML = '<p class="text-soft">Danh mục chưa tải được.</p>';
    featEl.innerHTML = renderErrorState(err.message, 'retry-home');
    revEl.innerHTML = '<p class="text-soft">Đánh giá chưa tải được.</p>';
    document.getElementById('retry-home')?.addEventListener('click', loadHomeData);
  }
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-quick-add]');
  if (!btn || btn.disabled) return;
  const variantId = btn.getAttribute('data-quick-add');
  btn.disabled = true;
  try {
    await addToCart(currentUser, variantId, 1);
    showToast('Đã thêm sản phẩm vào giỏ hàng.');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

(async () => {
  const flash = sessionStorage.getItem('nr_flash');
  if (flash) {
    sessionStorage.removeItem('nr_flash');
    showToast(flash, 'warn');
  }
  const auth = await initShopLayout('home');
  currentUser = auth.user;
  await loadHomeData();
})();
