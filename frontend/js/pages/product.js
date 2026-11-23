import { api } from '../api.js';
import { initShopLayout } from '../layout.js';
import {
  escapeHTML, formatVND, formatDate, ROAST_LABELS, renderStars,
  renderPagination, focusResults, renderProductCard, renderErrorState, renderEmptyState, showToast, setFieldErrors,
} from '../ui.js';
import { addToCart } from '../cart-store.js';

let currentUser = null;
let productData = null;
let selectedVariant = null;

function getSlug() {
  return new URLSearchParams(window.location.search).get('slug') || '';
}

function renderStockLine(stock) {
  if (stock <= 0) return '<span class="text-danger" style="font-weight:600;">Hết hàng</span>';
  if (stock <= 5) return `<span class="text-amber" style="font-weight:600;">Sắp hết: còn ${stock} sản phẩm</span>`;
  return `<span class="text-sage" style="font-weight:500;">Còn ${stock} sản phẩm</span>`;
}

function updateVariantUI() {
  if (!selectedVariant) return;
  const priceEl = document.getElementById('detail-price');
  const compareEl = document.getElementById('detail-compare');
  const stockEl = document.getElementById('detail-stock');
  const skuEl = document.getElementById('detail-sku');
  const qtyInput = document.getElementById('detail-qty');
  const addBtn = document.getElementById('btn-add-cart');
  const buyBtn = document.getElementById('btn-buy-now');

  priceEl.textContent = formatVND(selectedVariant.price);
  if (selectedVariant.compare_at_price && selectedVariant.compare_at_price > selectedVariant.price) {
    compareEl.textContent = formatVND(selectedVariant.compare_at_price);
    compareEl.classList.remove('hidden');
  } else {
    compareEl.classList.add('hidden');
  }

  stockEl.innerHTML = renderStockLine(selectedVariant.stock);
  if (skuEl) skuEl.textContent = selectedVariant.sku;

  const maxQty = Math.min(20, Math.max(1, selectedVariant.stock));
  qtyInput.max = String(maxQty);
  if (Number(qtyInput.value) > maxQty) qtyInput.value = String(maxQty);

  const disabled = selectedVariant.stock <= 0;
  addBtn.disabled = disabled;
  buyBtn.disabled = disabled;

  document.querySelectorAll('.variant-chip').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.vid) === Number(selectedVariant.id));
  });
}

async function loadReviews(slug, page = 1) {
  const listEl = document.getElementById('reviews-list');
  const pager = document.getElementById('reviews-pagination');
  pager.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try {
    const data = await api.get(`/api/products/${encodeURIComponent(slug)}/reviews?page=${page}&pageSize=5`);
    const html = data.items.map((r) => `
      <article style="padding-block:16px;border-bottom:1px solid var(--line);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div>
            <strong>${escapeHTML(r.authorName)}</strong>
            <span style="margin-left:8px;">${renderStars(r.rating, 13)}</span>
          </div>
          <span class="mono-label">${formatDate(r.createdAt)}</span>
        </div>
        <h4 style="font-family:var(--font-body);font-size:0.96rem;margin:0 0 4px;">${escapeHTML(r.title)}</h4>
        <p style="margin:0;color:var(--ink-soft);font-size:0.92rem;">${escapeHTML(r.content)}</p>
      </article>
    `).join('');

    listEl.innerHTML = html || '<p class="text-soft">Chưa có đánh giá nào cho sản phẩm này.</p>';
    pager.innerHTML = renderPagination(page, data.totalPages);
  } catch (err) {
    listEl.innerHTML = renderErrorState(err.message, 'retry-reviews');
    pager.innerHTML = '';
    document.getElementById('retry-reviews')?.addEventListener('click', () => loadReviews(slug, page));
  }
}

function renderProductDetail(p) {
  document.title = `${p.name} — Nhà Rang`;
  const bc = document.getElementById('product-breadcrumb');
  bc.innerHTML = `
    <a href="/index.html">Trang chủ</a> /
    <a href="/products.html?category=${encodeURIComponent(p.category_slug)}">${escapeHTML(p.category_name)}</a> /
    <span style="color:var(--ink);">${escapeHTML(p.name)}</span>
  `;

  selectedVariant = p.variants.find((v) => v.stock > 0) || p.variants[0] || null;
  const images = p.images.length > 0 ? p.images : [{ url: '/assets/placeholder.svg', alt_text: p.name }];

  let stamp = '';
  if (p.origin || p.roast_level) {
    const parts = [];
    if (p.origin) parts.push(p.origin);
    if (p.roast_level) parts.push(ROAST_LABELS[p.roast_level] || p.roast_level);
    stamp = `<div style="margin-bottom:12px;"><span class="coffee-stamp">${escapeHTML(parts.join(' · '))}</span></div>`;
  }

  const descParagraphs = p.description.split('\n').filter(Boolean).map((line) => `<p>${escapeHTML(line)}</p>`).join('');
  const rs = p.reviewSummary;
  const barsHtml = [5, 4, 3, 2, 1].map((star) => {
    const cnt = rs.breakdown[star] || 0;
    const pct = rs.totalReviews > 0 ? Math.round((cnt / rs.totalReviews) * 100) : 0;
    return `
      <div class="rating-bar-row">
        <span>${star} sao</span>
        <div class="rating-bar-track"><div class="rating-bar-fill" style="width:${pct}%"></div></div>
        <span class="tabular text-soft">${cnt}</span>
      </div>
    `;
  }).join('');

  let reviewFormHtml = '';
  if (!currentUser) {
    reviewFormHtml = `<p class="text-soft" style="margin-top:16px;">Bạn đã mua sản phẩm này? <a href="/auth.html?redirect=${encodeURIComponent('product.html?slug=' + p.slug)}" style="text-decoration:underline;color:var(--accent);">Đăng nhập</a> để viết đánh giá.</p>`;
  } else if (p.canReview) {
    reviewFormHtml = `
      <form id="review-form" class="panel" style="margin-top:20px;" novalidate>
        <h3 style="margin-bottom:12px;">Viết đánh giá của bạn</h3>
        <div class="form-group">
          <label class="form-label" for="rev-rating">Số sao</label>
          <select id="rev-rating" name="rating" class="form-control" style="max-width:200px;">
            <option value="5">5 sao — Rất hài lòng</option>
            <option value="4">4 sao — Hài lòng</option>
            <option value="3">3 sao — Bình thường</option>
            <option value="2">2 sao — Chưa ưng ý</option>
            <option value="1">1 sao — Không hài lòng</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="rev-title">Tiêu đề ngắn</label>
          <input id="rev-title" name="title" class="form-control" placeholder="Ví dụ: Hương cam rõ, hạt rang mới" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="rev-content">Cảm nhận chi tiết</label>
          <textarea id="rev-content" name="content" class="form-control" placeholder="Chia sẻ cách bạn pha và hương vị cảm nhận được..." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Gửi đánh giá</button>
      </form>
    `;
  } else if (p.hasReviewed) {
    reviewFormHtml = `<p class="text-sage" style="margin-top:16px;">Bạn đã gửi đánh giá cho sản phẩm này. Cảm ơn bạn!</p>`;
  } else if (currentUser.role === 'customer') {
    reviewFormHtml = `<p class="text-soft" style="margin-top:16px;">Chỉ khách hàng đã nhận đơn hàng chứa sản phẩm này mới có thể gửi đánh giá.</p>`;
  }

  const root = document.getElementById('product-root');
  root.innerHTML = `
    <div class="product-detail-grid">
      <div>
        <div class="gallery-main">
          <img id="gallery-main-img" src="${escapeHTML(images[0].url)}" alt="${escapeHTML(images[0].alt_text)}" width="600" height="750"
               onerror="this.onerror=null;this.src='/assets/placeholder.svg';">
        </div>
        <div class="gallery-thumbs">
          ${images.map((im, idx) => `
            <button type="button" class="gallery-thumb ${idx === 0 ? 'active' : ''}" data-img="${escapeHTML(im.url)}" data-alt="${escapeHTML(im.alt_text)}">
              <img src="${escapeHTML(im.url)}" alt="${escapeHTML(im.alt_text)}" width="150" height="150" loading="lazy"
                   onerror="this.onerror=null;this.src='/assets/placeholder.svg';">
            </button>
          `).join('')}
        </div>
      </div>

      <div>
        ${stamp}
        <h1 style="font-size:clamp(1.7rem,3vw,2.4rem);margin-bottom:8px;">${escapeHTML(p.name)}</h1>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          ${renderStars(rs.avgRating, 16)}
          <span class="text-soft">${rs.avgRating} / 5 (${rs.totalReviews} đánh giá)</span>
        </div>
        <p style="color:var(--ink-soft);font-size:1rem;margin-bottom:20px;">${escapeHTML(p.short_description)}</p>

        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:16px;">
          <span id="detail-price" class="tabular" style="font-size:1.75rem;font-weight:700;"></span>
          <span id="detail-compare" class="price-compare hidden" style="font-size:1.05rem;"></span>
        </div>

        <div style="margin-bottom:16px;">
          <span class="form-label">Chọn phiên bản:</span>
          <div class="variant-chips">
            ${p.variants.map((v) => `
              <button type="button" class="variant-chip" data-vid="${v.id}" ${v.stock <= 0 ? 'disabled' : ''}>
                ${escapeHTML(v.label)}
              </button>
            `).join('')}
          </div>
          <div id="detail-stock" style="font-size:0.9rem;"></div>
        </div>

        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:20px;">
          <div class="qty-control">
            <button type="button" id="qty-dec" aria-label="Giảm số lượng">−</button>
            <input type="number" id="detail-qty" value="1" min="1" max="20" aria-label="Số lượng">
            <button type="button" id="qty-inc" aria-label="Tăng số lượng">+</button>
          </div>
          <button type="button" class="btn btn-primary" id="btn-add-cart" style="flex:1;min-width:160px;">Thêm vào giỏ</button>
          <button type="button" class="btn btn-secondary" id="btn-buy-now">Mua ngay</button>
        </div>
      </div>
    </div>

    <div class="tabs-nav" role="tablist">
      <button type="button" class="tab-btn active" data-ptab="desc">Mô tả sản phẩm</button>
      <button type="button" class="tab-btn" data-ptab="specs">Thông tin chi tiết</button>
      <button type="button" class="tab-btn" data-ptab="reviews">Đánh giá (${rs.totalReviews})</button>
    </div>

    <div id="ptab-desc" style="max-width:760px;">${descParagraphs}</div>

    <div id="ptab-specs" class="hidden" style="max-width:640px;">
      <div class="table-wrap">
        <table class="data-table">
          <tbody>
            <tr><th>Danh mục</th><td>${escapeHTML(p.category_name)}</td></tr>
            <tr><th>Mã SKU đang chọn</th><td class="mono-label" id="detail-sku">—</td></tr>
            ${p.origin ? `<tr><th>Vùng trồng / Nguồn gốc</th><td>${escapeHTML(p.origin)}</td></tr>` : ''}
            ${p.roast_level ? `<tr><th>Mức rang</th><td>${escapeHTML(ROAST_LABELS[p.roast_level] || p.roast_level)}</td></tr>` : ''}
            <tr><th>Số phiên bản</th><td>${p.variants.length}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="ptab-reviews" class="hidden">
      <div style="display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start;margin-bottom:24px;">
        <div class="panel" style="text-align:center;">
          <div style="font-family:var(--font-display);font-size:2.6rem;font-weight:700;">${rs.avgRating}</div>
          <div>${renderStars(rs.avgRating, 18)}</div>
          <p class="text-soft" style="margin:8px 0 0;">Dựa trên ${rs.totalReviews} đánh giá đã xác thực</p>
        </div>
        <div class="panel">${barsHtml}</div>
      </div>
      ${reviewFormHtml}
      <div id="reviews-list" style="margin-top:20px;"></div>
      <div id="reviews-pagination"></div>
    </div>
  `;

  updateVariantUI();

  // Su kien chon anh nho
  root.querySelectorAll('.gallery-thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('gallery-main-img').src = btn.dataset.img;
      document.getElementById('gallery-main-img').alt = btn.dataset.alt;
      root.querySelectorAll('.gallery-thumb').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Su kien chon bien the
  root.querySelectorAll('.variant-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedVariant = p.variants.find((v) => Number(v.id) === Number(btn.dataset.vid));
      updateVariantUI();
    });
  });

  // Tang giam so luong
  const qtyInput = document.getElementById('detail-qty');
  document.getElementById('qty-dec').addEventListener('click', () => {
    qtyInput.value = String(Math.max(1, Number(qtyInput.value) - 1));
  });
  document.getElementById('qty-inc').addEventListener('click', () => {
    const maxQ = Math.min(20, selectedVariant?.stock || 1);
    qtyInput.value = String(Math.min(maxQ, Number(qtyInput.value) + 1));
  });

  // Them vao gio & Mua ngay
  const handleAdd = async (goToCart) => {
    if (!selectedVariant) return;
    const qty = Math.max(1, Math.min(20, parseInt(qtyInput.value, 10) || 1));
    try {
      await addToCart(currentUser, selectedVariant.id, qty);
      if (goToCart) window.location.href = '/cart.html';
      else showToast(`Đã thêm ${qty} × ${p.name} vào giỏ.`);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
  document.getElementById('btn-add-cart').addEventListener('click', () => handleAdd(false));
  document.getElementById('btn-buy-now').addEventListener('click', () => handleAdd(true));

  // Chuyen 3 tab
  root.querySelectorAll('[data-ptab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.ptab;
      root.querySelectorAll('[data-ptab]').forEach((b) => b.classList.toggle('active', b === btn));
      ['desc', 'specs', 'reviews'].forEach((t) => {
        document.getElementById(`ptab-${t}`).classList.toggle('hidden', t !== target);
      });
    });
  });

  document.getElementById('reviews-pagination').addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    await loadReviews(p.slug, Number(button.dataset.page));
    focusResults(document.getElementById('reviews-list'));
  });

  // Gui danh gia
  const revForm = document.getElementById('review-form');
  if (revForm) {
    revForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setFieldErrors(revForm, {});
      try {
        await api.post(`/api/products/${encodeURIComponent(p.slug)}/reviews`, {
          rating: Number(revForm.rating.value),
          title: revForm.title.value,
          content: revForm.content.value,
        });
        showToast('Cảm ơn bạn đã gửi đánh giá!');
        window.location.reload();
      } catch (err) {
        setFieldErrors(revForm, err.errors);
        showToast(err.message, 'error');
      }
    });
  }

  // Tu dong mo tab danh gia neu URL co #reviews
  if (window.location.hash === '#reviews') {
    root.querySelector('[data-ptab="reviews"]')?.click();
  }
}

async function loadPage() {
  const slug = getSlug();
  const root = document.getElementById('product-root');
  if (!slug) {
    root.innerHTML = renderEmptyState('Không tìm thấy sản phẩm', 'Đường dẫn sản phẩm thiếu thông tin.', '/products.html', 'Về cửa hàng');
    return;
  }

  root.innerHTML = '<div class="skeleton" style="height:420px;"></div>';
  try {
    productData = await api.get(`/api/products/${encodeURIComponent(slug)}`);
    renderProductDetail(productData);
    await loadReviews(slug);

    const related = await api.get(`/api/products/${encodeURIComponent(slug)}/related`);
    if (related.length > 0) {
      document.getElementById('related-section').classList.remove('hidden');
      const rGrid = document.getElementById('related-grid');
      rGrid.innerHTML = related.map(renderProductCard).join('');
      rGrid.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-quick-add]');
        if (!btn || btn.disabled) return;
        try {
          await addToCart(currentUser, btn.dataset.quickAdd, 1);
          showToast('Đã thêm sản phẩm vào giỏ hàng.');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  } catch (err) {
    if (err.status === 404) {
      root.innerHTML = renderEmptyState(
        'Không tìm thấy sản phẩm',
        'Sản phẩm này không tồn tại hoặc đã ngừng kinh doanh tại Nhà Rang.',
        '/products.html',
        'Quay lại cửa hàng'
      );
    } else {
      root.innerHTML = renderErrorState(err.message, 'retry-product');
      document.getElementById('retry-product')?.addEventListener('click', loadPage);
    }
  }
}

(async () => {
  const auth = await initShopLayout('shop');
  currentUser = auth.user;
  await loadPage();
})();
