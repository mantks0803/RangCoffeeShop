// Tien ich giao dien dung chung: chong XSS, dinh dang tien/ngay, toast, modal, the san pham

export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const vndFormatter = new Intl.NumberFormat('vi-VN');
export function formatVND(amount) {
  return `${vndFormatter.format(Math.round(Number(amount || 0)))} ₫`;
}

export function formatDate(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTime(dateVal) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export const ROAST_LABELS = {
  light: 'Rang nhạt',
  medium: 'Rang vừa',
  dark: 'Rang đậm',
};

export const STATUS_LABELS = {
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'Chưa thanh toán',
  paid: 'Đã thanh toán',
  refunded: 'Đã hoàn tiền',
};

export const PAYMENT_METHOD_LABELS = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
};

export function renderStatusPill(status) {
  const label = STATUS_LABELS[status] || status;
  return `<span class="pill pill-${escapeHTML(status)}">${escapeHTML(label)}</span>`;
}

export function renderPaymentPill(status) {
  const label = PAYMENT_STATUS_LABELS[status] || status;
  return `<span class="pill pill-${escapeHTML(status)}">${escapeHTML(label)}</span>`;
}

// Hien thong bao toast o goc duoi phai
export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${escapeHTML(message)}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 200ms ease';
    setTimeout(() => el.remove(), 220);
  }, 3200);
}

// Hop thoai xac nhan cho thao tac nguy hiem (ho tro phim Esc)
export function confirmDialog({ title, message, confirmText = 'Xác nhận', danger = true }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>${escapeHTML(title)}</h3>
          <button type="button" class="icon-btn" data-close aria-label="Đóng">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <p>${escapeHTML(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-close>Hủy bỏ</button>
          <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;

    const cleanup = (val) => {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(val);
    };
    const onKey = (e) => { if (e.key === 'Escape') cleanup(false); };
    document.addEventListener('keydown', onKey);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-close]')) cleanup(false);
      if (e.target.closest('[data-confirm]')) cleanup(true);
    });

    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-confirm]')?.focus();
  });
}

// Render ngoi sao SVG (khong dung emoji)
export function renderStars(rating, size = 14) {
  const rounded = Math.round(Number(rating || 0));
  let html = '<span style="display:inline-flex;gap:2px;vertical-align:middle;color:var(--accent);" aria-label="' + escapeHTML(String(rating)) + ' trên 5 sao">';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rounded;
    html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></svg>`;
  }
  html += '</span>';
  return html;
}

// Render the san pham dung chung cho trang chu, cua hang, san pham lien quan
export function renderProductCard(p) {
  const isOos = Number(p.total_stock || 0) <= 0;
  const hasDiscount = p.min_compare_at_price && Number(p.min_compare_at_price) > Number(p.min_price);
  const discountPct = hasDiscount
    ? Math.round(((p.min_compare_at_price - p.min_price) / p.min_compare_at_price) * 100)
    : 0;

  // Tem nhan tui ca phe cho nhom ca phe co origin/roast
  let stampHtml = '';
  if (p.origin || p.roast_level) {
    const parts = [];
    if (p.origin) parts.push(p.origin.split('·')[0].trim());
    if (p.roast_level) parts.push(ROAST_LABELS[p.roast_level] || p.roast_level);
    stampHtml = `<div><span class="coffee-stamp">${escapeHTML(parts.join(' · '))}</span></div>`;
  }

  const pricePrefix = Number(p.variant_count || 1) > 1 ? 'Từ ' : '';
  const imgUrl = p.primary_image || '/assets/placeholder.svg';

  return `
    <article class="product-card">
      <a class="product-card-media" href="/product.html?slug=${encodeURIComponent(p.slug)}">
        <img src="${escapeHTML(imgUrl)}" alt="${escapeHTML(p.name)}" width="400" height="500" loading="lazy"
             onerror="this.onerror=null;this.src='/assets/placeholder.svg';">
        ${isOos ? '<span class="product-badge-oos">HẾT HÀNG</span>' : (hasDiscount ? `<span class="product-badge-sale">-${discountPct}%</span>` : '')}
      </a>
      <div class="product-card-body">
        <span class="product-card-cat">${escapeHTML(p.category_name || '')}</span>
        ${stampHtml}
        <h3 class="product-card-title">
          <a href="/product.html?slug=${encodeURIComponent(p.slug)}">${escapeHTML(p.name)}</a>
        </h3>
        <div class="product-card-meta">
          ${renderStars(p.avg_rating, 13)}
          <span>(${Number(p.review_count || 0)})</span>
        </div>
        <div class="product-card-price">
          <span class="price-current">${pricePrefix}${formatVND(p.min_price)}</span>
          ${hasDiscount ? `<span class="price-compare">${formatVND(p.min_compare_at_price)}</span>` : ''}
        </div>
        <button type="button" class="btn btn-secondary btn-sm btn-block" style="margin-top:8px;"
                data-quick-add="${p.default_variant_id || ''}" ${isOos || !p.default_variant_id ? 'disabled' : ''}>
          ${isOos ? 'Tạm hết hàng' : 'Thêm vào giỏ'}
        </button>
      </div>
    </article>
  `;
}

export function renderProductSkeletons(count = 4) {
  return Array.from({ length: count }).map(() => `
    <div class="product-card">
      <div class="skeleton" style="aspect-ratio:4/5;"></div>
      <div class="product-card-body">
        <div class="skeleton" style="height:14px;width:45%;"></div>
        <div class="skeleton" style="height:20px;width:90%;"></div>
        <div class="skeleton" style="height:16px;width:60%;"></div>
        <div class="skeleton" style="height:36px;width:100%;margin-top:8px;"></div>
      </div>
    </div>
  `).join('');
}

export function renderErrorState(message, retryId = 'retry-btn') {
  return `
    <div class="state-box">
      <h3>Không tải được dữ liệu</h3>
      <p>${escapeHTML(message || 'Đã xảy ra lỗi khi kết nối máy chủ.')}</p>
      <button type="button" class="btn btn-primary" id="${escapeHTML(retryId)}">Thử lại</button>
    </div>
  `;
}

export function renderEmptyState(title, desc, actionHref = null, actionLabel = null) {
  return `
    <div class="state-box">
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(desc)}</p>
      ${actionHref && actionLabel ? `<a class="btn btn-primary" href="${escapeHTML(actionHref)}">${escapeHTML(actionLabel)}</a>` : ''}
    </div>
  `;
}

export function focusResults(element) {
  element.tabIndex = -1;
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'start' });
}

export function renderPagination(page, totalPages) {
  if (totalPages <= 1) return '';
  const pages = [...new Set([1, page - 1, page, page + 1, totalPages])]
    .filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const numbered = pages.map((n, index) => {
    const gap = index && n - pages[index - 1] > 1 ? '<span aria-hidden="true">…</span>' : '';
    const current = n === page ? ' class="active" aria-current="page"' : '';
    return `${gap}<button type="button" data-page="${n}" aria-label="Trang ${n}"${current}>${n}</button>`;
  }).join('');
  return `<nav class="pagination" aria-label="Phân trang">
    <button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Trước</button>
    <span class="page-numbers">${numbered}</span>
    <span class="page-counter">Trang ${page} / ${totalPages}</span>
    <button type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Sau</button>
  </nav>`;
}

// Gan loi validate tung truong len form (aria-invalid + aria-describedby)
export function setFieldErrors(formEl, errors = {}) {
  formEl.querySelectorAll('.field-error').forEach((el) => el.remove());
  formEl.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  });
  if (!errors) return;
  for (const [field, msg] of Object.entries(errors)) {
    const input = formEl.querySelector(`[name="${field}"]`);
    if (!input) continue;
    const errId = `err-${field}`;
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', errId);
    const div = document.createElement('div');
    div.id = errId;
    div.className = 'field-error';
    div.textContent = msg;
    input.insertAdjacentElement('afterend', div);
  }
}
