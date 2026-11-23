import { api } from '../api.js';
import { initShopLayout } from '../layout.js';
import { escapeHTML, formatVND, renderEmptyState, renderErrorState, showToast } from '../ui.js';
import { getGuestCart, saveGuestCart, loadCartSummary, countItems, updateCartBadge } from '../cart-store.js';

let currentUser = null;
let cartSummary = null;
let appliedCoupon = null;

function renderCart() {
  const root = document.getElementById('cart-root');
  if (!cartSummary || cartSummary.items.length === 0) {
    root.innerHTML = `
      <div style="padding-block:var(--s6);">
        ${renderEmptyState(
          'Giỏ hàng của bạn đang trống',
          'Hãy chọn vài gói cà phê rang mới hoặc dụng cụ pha để bắt đầu.',
          '/products.html?category=ca-phe-rang',
          'Đi chọn cà phê'
        )}
      </div>
    `;
    return;
  }

  const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const finalTotal = Math.max(0, cartSummary.subtotal + cartSummary.shippingFee - discountAmount);
  const progressPct = Math.min(100, Math.round((cartSummary.subtotal / cartSummary.freeShipThreshold) * 100));

  root.innerHTML = `
    <div class="two-col-layout">
      <div class="panel">
        ${cartSummary.items.map((item) => `
          <div class="cart-item-row" data-vid="${item.variantId}">
            <img class="cart-item-img" src="${escapeHTML(item.image || '/assets/placeholder.svg')}" alt="${escapeHTML(item.productName)}"
                 onerror="this.onerror=null;this.src='/assets/placeholder.svg';">
            <div>
              <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
                <div>
                  <a href="${item.productSlug ? `/product.html?slug=${encodeURIComponent(item.productSlug)}` : '#'}" style="font-weight:600;">
                    ${escapeHTML(item.productName)}
                  </a>
                  <div class="text-soft" style="font-size:0.86rem;">${escapeHTML(item.variantLabel)} · ${formatVND(item.price)}</div>
                </div>
                <strong class="tabular">${formatVND(item.lineTotal)}</strong>
              </div>
              ${item.warning ? `<p class="text-danger" style="font-size:0.84rem;margin:6px 0 0;">${escapeHTML(item.warning)}</p>` : ''}
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;">
                <div class="qty-control">
                  <button type="button" data-qty-dec="${item.variantId}" ${item.quantity <= 1 ? 'disabled' : ''} aria-label="Giảm">−</button>
                  <input type="number" value="${item.quantity}" min="1" max="${Math.min(20, Math.max(1, item.stock))}" data-qty-input="${item.variantId}" aria-label="Số lượng">
                  <button type="button" data-qty-inc="${item.variantId}" ${item.quantity >= Math.min(20, item.stock) ? 'disabled' : ''} aria-label="Tăng">+</button>
                </div>
                <button type="button" class="btn btn-ghost btn-sm text-danger" data-remove="${item.variantId}">Xóa</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <aside class="panel">
        <h2 style="font-size:1.25rem;margin-bottom:12px;">Tóm tắt đơn hàng</h2>

        <div style="font-size:0.86rem;">
          ${cartSummary.freeShipRemaining > 0
            ? `Mua thêm <strong>${formatVND(cartSummary.freeShipRemaining)}</strong> để được miễn phí giao hàng.`
            : `<span class="text-sage" style="font-weight:600;">Đơn hàng của bạn đã đủ điều kiện miễn phí giao hàng.</span>`}
        </div>
        <div class="freeship-bar"><div class="freeship-bar-fill" style="width:${progressPct}%"></div></div>

        <form id="coupon-form" style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" id="coupon-input" class="form-control" placeholder="Mã giảm giá (vd: WELCOME10)" value="${escapeHTML(appliedCoupon?.code || '')}" style="text-transform:uppercase;">
          <button type="submit" class="btn btn-secondary btn-sm">Áp dụng</button>
        </form>
        <div id="coupon-msg" style="font-size:0.84rem;margin:-10px 0 14px;">
          ${appliedCoupon ? `<span class="text-sage">Đã áp dụng mã <strong>${escapeHTML(appliedCoupon.code)}</strong>: -${formatVND(appliedCoupon.discountAmount)}</span>` : ''}
        </div>

        <div class="summary-row">
          <span class="text-soft">Tạm tính</span>
          <span class="tabular">${formatVND(cartSummary.subtotal)}</span>
        </div>
        <div class="summary-row">
          <span class="text-soft">Phí giao hàng</span>
          <span class="tabular">${cartSummary.shippingFee === 0 ? 'Miễn phí' : formatVND(cartSummary.shippingFee)}</span>
        </div>
        ${discountAmount > 0 ? `
          <div class="summary-row text-sage">
            <span>Giảm giá (${escapeHTML(appliedCoupon.code)})</span>
            <span class="tabular">-${formatVND(discountAmount)}</span>
          </div>
        ` : ''}
        <div class="summary-row summary-total">
          <span>Tổng cộng</span>
          <span class="tabular">${formatVND(finalTotal)}</span>
        </div>

        ${cartSummary.hasUnavailable ? `<p class="text-danger" style="font-size:0.86rem;margin-top:12px;">Vui lòng xóa hoặc điều chỉnh các sản phẩm hết hàng trước khi thanh toán.</p>` : ''}

        <button type="button" class="btn btn-primary btn-block" id="btn-checkout" style="margin-top:16px;" ${cartSummary.hasUnavailable ? 'disabled' : ''}>
          Tiến hành thanh toán
        </button>
      </aside>
    </div>
  `;

  bindCartActions();
}

async function updateQuantity(variantId, nextQty) {
  const vid = Number(variantId);
  const qty = Math.max(1, Math.min(20, Number(nextQty)));
  try {
    if (currentUser && currentUser.role === 'customer') {
      cartSummary = await api.put(`/api/cart/items/${vid}`, { quantity: qty });
      updateCartBadge(countItems(cartSummary.items));
    } else {
      const list = getGuestCart();
      const idx = list.findIndex((x) => Number(x.variantId) === vid);
      if (idx >= 0) list[idx].quantity = qty;
      saveGuestCart(list);
      cartSummary = await loadCartSummary(null);
    }
    appliedCoupon = null;
    sessionStorage.removeItem('nr_coupon_code');
    renderCart();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function removeItem(variantId) {
  const vid = Number(variantId);
  try {
    if (currentUser && currentUser.role === 'customer') {
      cartSummary = await api.del(`/api/cart/items/${vid}`);
      updateCartBadge(countItems(cartSummary.items));
    } else {
      const list = getGuestCart().filter((x) => Number(x.variantId) !== vid);
      saveGuestCart(list);
      cartSummary = await loadCartSummary(null);
    }
    appliedCoupon = null;
    sessionStorage.removeItem('nr_coupon_code');
    showToast('Đã xóa sản phẩm khỏi giỏ.');
    renderCart();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function bindCartActions() {
  const root = document.getElementById('cart-root');
  root.querySelectorAll('[data-qty-dec]').forEach((b) => {
    b.addEventListener('click', () => {
      const vid = Number(b.dataset.qtyDec);
      const item = cartSummary.items.find((i) => i.variantId === vid);
      if (item && item.quantity > 1) updateQuantity(vid, item.quantity - 1);
    });
  });
  root.querySelectorAll('[data-qty-inc]').forEach((b) => {
    b.addEventListener('click', () => {
      const vid = Number(b.dataset.qtyInc);
      const item = cartSummary.items.find((i) => i.variantId === vid);
      if (item) updateQuantity(vid, item.quantity + 1);
    });
  });
  root.querySelectorAll('[data-qty-input]').forEach((inp) => {
    inp.addEventListener('change', () => updateQuantity(inp.dataset.qtyInput, inp.value));
  });
  root.querySelectorAll('[data-remove]').forEach((b) => {
    b.addEventListener('click', () => removeItem(b.dataset.remove));
  });

  const couponForm = document.getElementById('coupon-form');
  couponForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('coupon-input').value.trim().toUpperCase();
    const msgEl = document.getElementById('coupon-msg');
    if (!code) {
      appliedCoupon = null;
      sessionStorage.removeItem('nr_coupon_code');
      renderCart();
      return;
    }
    if (!currentUser || currentUser.role !== 'customer') {
      msgEl.innerHTML = '<span class="text-amber">Vui lòng đăng nhập để kiểm tra và áp dụng mã giảm giá.</span>';
      return;
    }
    try {
      appliedCoupon = await api.post('/api/coupons/validate', { code });
      sessionStorage.setItem('nr_coupon_code', appliedCoupon.code);
      showToast(`Đã áp dụng mã ${appliedCoupon.code}.`);
      renderCart();
    } catch (err) {
      appliedCoupon = null;
      sessionStorage.removeItem('nr_coupon_code');
      msgEl.innerHTML = `<span class="text-danger">${escapeHTML(err.message)}</span>`;
    }
  });

  document.getElementById('btn-checkout')?.addEventListener('click', () => {
    if (!currentUser) {
      window.location.href = '/auth.html?redirect=checkout.html';
      return;
    }
    if (currentUser.role !== 'customer') {
      showToast('Tài khoản quản trị không thể đặt mua hàng.', 'warn');
      return;
    }
    window.location.href = '/checkout.html';
  });
}

async function init() {
  const auth = await initShopLayout('');
  currentUser = auth.user;
  const root = document.getElementById('cart-root');
  root.innerHTML = '<div class="skeleton" style="height:260px;margin-top:24px;"></div>';

  try {
    cartSummary = await loadCartSummary(currentUser);
    const savedCode = sessionStorage.getItem('nr_coupon_code');
    if (savedCode && currentUser && currentUser.role === 'customer' && cartSummary.subtotal > 0) {
      try {
        appliedCoupon = await api.post('/api/coupons/validate', { code: savedCode });
      } catch {
        sessionStorage.removeItem('nr_coupon_code');
      }
    }
    renderCart();
  } catch (err) {
    root.innerHTML = renderErrorState(err.message, 'retry-cart');
    document.getElementById('retry-cart')?.addEventListener('click', init);
  }
}

init();
