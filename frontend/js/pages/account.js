import { api } from '../api.js';
import { initShopLayout } from '../layout.js';
import {
  escapeHTML, formatVND, formatDate, formatDateTime,
  renderStatusPill, renderPaymentPill, PAYMENT_METHOD_LABELS,
  STATUS_LABELS, renderPagination, focusResults, renderEmptyState,
  showToast, confirmDialog, setFieldErrors,
} from '../ui.js';

let currentUser = null;
let orderFilterStatus = '';
let orderPage = 1;

function getActiveTab() {
  const h = window.location.hash.replace('#', '');
  return ['profile', 'orders', 'addresses', 'security'].includes(h) ? h : 'profile';
}

function updateNavActive(tab) {
  document.querySelectorAll('#account-nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.tab === tab);
  });
}

// ===== TAB 1: HO SO =====
async function renderProfileTab() {
  const host = document.getElementById('account-content');
  const u = await api.get('/api/account/profile', { redirectOn401: true });
  currentUser = u;
  const bdayVal = u.birthday ? String(u.birthday).slice(0, 10) : '';

  host.innerHTML = `
    <div class="panel">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--line);">
        <div>
          <h2 style="font-size:1.3rem;margin-bottom:4px;">Hồ sơ cá nhân</h2>
          <span class="text-soft" style="font-size:0.88rem;">Tham gia từ ${formatDate(u.createdAt)}</span>
        </div>
        <div style="text-align:right;">
          <div class="mono-label">ĐIỂM TÍCH LŨY</div>
          <strong class="tabular" style="font-size:1.35rem;color:var(--accent);">${Number(u.loyaltyPoints || 0)} điểm</strong>
        </div>
      </div>

      <form id="profile-form" style="max-width:520px;" novalidate>
        <div class="form-group">
          <label class="form-label" for="pf-email">Email (không thể thay đổi)</label>
          <input id="pf-email" class="form-control" value="${escapeHTML(u.email)}" disabled>
        </div>
        <div class="form-group">
          <label class="form-label" for="pf-name">Họ và tên</label>
          <input id="pf-name" name="fullName" class="form-control" value="${escapeHTML(u.fullName)}" required>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label" for="pf-phone">Số điện thoại</label>
            <input id="pf-phone" name="phone" class="form-control" value="${escapeHTML(u.phone || '')}" placeholder="0901234567">
          </div>
          <div class="form-group">
            <label class="form-label" for="pf-bday">Ngày sinh</label>
            <input id="pf-bday" name="birthday" type="date" class="form-control" value="${escapeHTML(bdayVal)}">
          </div>
        </div>
        <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
      </form>
    </div>
  `;

  const form = document.getElementById('profile-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldErrors(form, {});
    try {
      await api.put('/api/account/profile', {
        fullName: form.fullName.value.trim(),
        phone: form.phone.value.trim(),
        birthday: form.birthday.value,
      });
      showToast('Đã cập nhật hồ sơ cá nhân.');
    } catch (err) {
      setFieldErrors(form, err.errors);
      showToast(err.message, 'error');
    }
  });
}

// ===== TAB 2: DON HANG =====
async function renderOrdersTab() {
  const host = document.getElementById('account-content');
  const qs = new URLSearchParams({ page: String(orderPage), pageSize: '6' });
  if (orderFilterStatus) qs.set('status', orderFilterStatus);

  const data = await api.get(`/api/orders?${qs.toString()}`, { redirectOn401: true });
  const statuses = [
    ['', 'Tất cả'], ['pending', 'Chờ xử lý'], ['confirmed', 'Đã xác nhận'],
    ['shipping', 'Đang giao'], ['completed', 'Hoàn tất'], ['cancelled', 'Đã hủy'],
  ];

  host.innerHTML = `
    <div class="panel">
      <h2 style="font-size:1.3rem;margin-bottom:14px;">Đơn hàng của tôi</h2>
      <div class="chip-row" style="margin-bottom:16px;">
        ${statuses.map(([val, label]) => `
          <button type="button" class="filter-chip ${orderFilterStatus === val ? 'active' : ''}" data-ostatus="${val}">
            ${label}
          </button>
        `).join('')}
      </div>

      ${data.items.length === 0
        ? renderEmptyState('Chưa có đơn hàng nào', 'Các đơn hàng bạn đặt tại Nhà Rang sẽ hiển thị tại đây.', '/products.html', 'Mua sắm ngay')
        : `
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày đặt</th>
                  <th>Trạng thái</th>
                  <th>Thanh toán</th>
                  <th style="text-align:right;">Tổng tiền</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map((o) => `
                  <tr class="clickable" data-open-order="${escapeHTML(o.order_code)}">
                    <td class="mono-label" style="color:var(--ink);font-weight:600;">${escapeHTML(o.order_code)}</td>
                    <td>${formatDate(o.created_at)}</td>
                    <td>${renderStatusPill(o.status)}</td>
                    <td>${renderPaymentPill(o.payment_status)}</td>
                    <td class="tabular" style="text-align:right;font-weight:600;">${formatVND(o.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${renderPagination(data.page, data.totalPages)}
        `
      }
    </div>
  `;

  host.querySelectorAll('[data-ostatus]').forEach((b) => {
    b.addEventListener('click', () => {
      orderFilterStatus = b.dataset.ostatus;
      orderPage = 1;
      renderOrdersTab();
    });
  });

  host.querySelectorAll('[data-page]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (b.disabled) return;
      orderPage = Number(b.dataset.page);
      await renderOrdersTab();
      focusResults(host);
    });
  });

  host.querySelectorAll('[data-open-order]').forEach((tr) => {
    tr.addEventListener('click', () => openOrderDetailModal(tr.dataset.openOrder));
  });
}

async function openOrderDetailModal(code) {
  try {
    const o = await api.get(`/api/orders/${encodeURIComponent(code)}`, { redirectOn401: true });
    const backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    backdrop.innerHTML = `
      <div class="drawer-panel" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div>
            <span class="mono-label">CHI TIẾT ĐƠN HÀNG</span>
            <h3 style="margin:4px 0 0;">${escapeHTML(o.order_code)}</h3>
          </div>
          <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          ${renderStatusPill(o.status)}
          ${renderPaymentPill(o.payment_status)}
          <span class="pill pill-unpaid">${escapeHTML(PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method)}</span>
        </div>

        <div style="font-size:0.9rem;margin-bottom:16px;padding:12px;background:var(--bg);border-radius:var(--radius);">
          <strong>${escapeHTML(o.recipient_name)}</strong> · ${escapeHTML(o.phone)}<br>
          ${escapeHTML(o.shipping_address)}
          ${o.note ? `<div class="text-soft" style="margin-top:6px;">Ghi chú: ${escapeHTML(o.note)}</div>` : ''}
        </div>

        <h4 style="font-family:var(--font-body);font-size:0.95rem;margin-bottom:8px;">Sản phẩm đã đặt</h4>
        <div style="border-top:1px solid var(--line);margin-bottom:16px;">
          ${o.items.map((item) => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);">
              <div>
                <strong>${escapeHTML(item.product_name)}</strong>
                <div class="text-soft" style="font-size:0.84rem;">${escapeHTML(item.variant_label)} · ${formatVND(item.unit_price)} × ${item.quantity}</div>
                ${o.status === 'completed' && item.product_slug ? (
                  item.has_reviewed
                    ? '<span class="text-sage" style="font-size:0.8rem;">Đã đánh giá</span>'
                    : `<a href="/product.html?slug=${encodeURIComponent(item.product_slug)}#reviews" style="font-size:0.82rem;color:var(--accent);text-decoration:underline;">Viết đánh giá</a>`
                ) : ''}
              </div>
              <strong class="tabular">${formatVND(item.line_total)}</strong>
            </div>
          `).join('')}
        </div>

        <div class="summary-row"><span class="text-soft">Tạm tính</span><span class="tabular">${formatVND(o.subtotal)}</span></div>
        <div class="summary-row"><span class="text-soft">Phí giao hàng</span><span class="tabular">${o.shipping_fee === 0 ? 'Miễn phí' : formatVND(o.shipping_fee)}</span></div>
        ${o.discount_amount > 0 ? `<div class="summary-row text-sage"><span>Giảm giá</span><span class="tabular">-${formatVND(o.discount_amount)}</span></div>` : ''}
        <div class="summary-row summary-total"><span>Tổng cộng</span><span class="tabular">${formatVND(o.total)}</span></div>

        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:20px;">
          ${o.status === 'pending' ? `<button type="button" class="btn btn-danger btn-sm" id="btn-cancel-order">Hủy đơn hàng</button>` : ''}
          <button type="button" class="btn btn-secondary btn-sm" id="btn-reorder">Mua lại</button>
        </div>

        <h4 style="font-family:var(--font-body);font-size:0.95rem;margin-top:24px;">Lịch sử trạng thái</h4>
        <ul class="timeline">
          ${o.history.map((h) => `
            <li>
              <strong>${escapeHTML(STATUS_LABELS[h.to_status] || h.to_status)}</strong>
              <div class="text-soft" style="font-size:0.82rem;">${formatDateTime(h.created_at)}</div>
              ${h.note ? `<div style="font-size:0.86rem;">${escapeHTML(h.note)}</div>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    const close = () => {
      document.removeEventListener('keydown', onEsc);
      backdrop.remove();
    };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.closest('[data-close]')) close();
    });

    backdrop.querySelector('#btn-cancel-order')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Xác nhận hủy đơn hàng',
        message: `Bạn có chắc muốn hủy đơn ${o.order_code}? Số lượng sản phẩm sẽ được hoàn lại kho.`,
        confirmText: 'Hủy đơn',
      });
      if (!ok) return;
      try {
        await api.post(`/api/orders/${encodeURIComponent(o.order_code)}/cancel`, {});
        showToast('Đã hủy đơn hàng.');
        close();
        renderOrdersTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    backdrop.querySelector('#btn-reorder')?.addEventListener('click', async () => {
      try {
        const res = await api.post(`/api/orders/${encodeURIComponent(o.order_code)}/reorder`, {});
        if (res.added > 0) {
          showToast(`Đã thêm ${res.added} món vào giỏ hàng.${res.skipped ? ` (${res.skipped} món hết hàng)` : ''}`);
          window.location.href = '/cart.html';
        } else {
          showToast('Các sản phẩm trong đơn này hiện đã hết hàng.', 'warn');
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.body.appendChild(backdrop);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ===== TAB 3: DIA CHI =====
async function renderAddressesTab() {
  const host = document.getElementById('account-content');
  const list = await api.get('/api/account/addresses', { redirectOn401: true });

  host.innerHTML = `
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2 style="font-size:1.3rem;margin:0;">Sổ địa chỉ</h2>
        <button type="button" class="btn btn-primary btn-sm" id="btn-add-address">+ Thêm địa chỉ</button>
      </div>
      ${list.length === 0
        ? renderEmptyState('Chưa có địa chỉ giao hàng', 'Thêm địa chỉ để thanh toán nhanh hơn cho lần đặt sau.')
        : `<div style="display:grid;gap:12px;">
            ${list.map((a) => `
              <div style="padding:14px;border:1px solid var(--line);border-radius:var(--radius);display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;">
                <div>
                  <strong>${escapeHTML(a.recipient_name)}</strong> · ${escapeHTML(a.phone)}
                  ${a.is_default ? '<span class="pill pill-completed" style="margin-left:6px;">Mặc định</span>' : ''}
                  <div class="text-soft" style="font-size:0.9rem;margin-top:4px;">
                    ${escapeHTML(a.street)}, ${escapeHTML(a.ward)}, ${escapeHTML(a.district)}, ${escapeHTML(a.province)}
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  ${!a.is_default ? `<button type="button" class="btn btn-ghost btn-sm" data-addr-default="${a.id}">Đặt mặc định</button>` : ''}
                  <button type="button" class="btn btn-secondary btn-sm" data-addr-edit="${a.id}">Sửa</button>
                  <button type="button" class="btn btn-ghost btn-sm text-danger" data-addr-del="${a.id}">Xóa</button>
                </div>
              </div>
            `).join('')}
          </div>`
      }
    </div>
  `;

  document.getElementById('btn-add-address').addEventListener('click', () => openAddressModal(null));

  host.querySelectorAll('[data-addr-edit]').forEach((b) => {
    b.addEventListener('click', () => {
      const addr = list.find((x) => Number(x.id) === Number(b.dataset.addrEdit));
      if (addr) openAddressModal(addr);
    });
  });

  host.querySelectorAll('[data-addr-default]').forEach((b) => {
    b.addEventListener('click', async () => {
      try {
        await api.put(`/api/account/addresses/${b.dataset.addrDefault}/default`, {});
        showToast('Đã đặt làm địa chỉ mặc định.');
        renderAddressesTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  host.querySelectorAll('[data-addr-del]').forEach((b) => {
    b.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Xóa địa chỉ',
        message: 'Bạn có chắc muốn xóa địa chỉ này khỏi sổ địa chỉ?',
        confirmText: 'Xóa',
      });
      if (!ok) return;
      try {
        await api.del(`/api/account/addresses/${b.dataset.addrDel}`);
        showToast('Đã xóa địa chỉ.');
        renderAddressesTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function openAddressModal(addr) {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>${addr ? 'Cập nhật địa chỉ' : 'Thêm địa chỉ mới'}</h3>
        <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
      </div>
      <form id="addr-modal-form" novalidate>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Người nhận</label>
            <input name="recipientName" class="form-control" value="${escapeHTML(addr?.recipient_name || currentUser?.fullName || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Số điện thoại</label>
            <input name="phone" class="form-control" value="${escapeHTML(addr?.phone || currentUser?.phone || '')}" required>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Tỉnh / Thành phố</label>
            <input name="province" class="form-control" value="${escapeHTML(addr?.province || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Quận / Huyện</label>
            <input name="district" class="form-control" value="${escapeHTML(addr?.district || '')}" required>
          </div>
        </div>
        <div class="form-grid-2">
          <div class="form-group">
            <label class="form-label">Phường / Xã</label>
            <input name="ward" class="form-control" value="${escapeHTML(addr?.ward || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Số nhà, tên đường</label>
            <input name="street" class="form-control" value="${escapeHTML(addr?.street || '')}" required>
          </div>
        </div>
        <label class="filter-option">
          <input type="checkbox" name="isDefault" ${addr?.is_default ? 'checked' : ''}> Đặt làm địa chỉ mặc định
        </label>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" data-close>Hủy</button>
          <button type="submit" class="btn btn-primary">Lưu địa chỉ</button>
        </div>
      </form>
    </div>
  `;

  const close = () => {
    document.removeEventListener('keydown', onEsc);
    backdrop.remove();
  };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onEsc);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
  });

  const form = backdrop.querySelector('#addr-modal-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldErrors(form, {});
    const payload = {
      recipientName: form.recipientName.value.trim(),
      phone: form.phone.value.trim(),
      province: form.province.value.trim(),
      district: form.district.value.trim(),
      ward: form.ward.value.trim(),
      street: form.street.value.trim(),
      isDefault: form.isDefault.checked,
    };
    try {
      if (addr) await api.put(`/api/account/addresses/${addr.id}`, payload);
      else await api.post('/api/account/addresses', payload);
      showToast('Đã lưu địa chỉ.');
      close();
      renderAddressesTab();
    } catch (err) {
      setFieldErrors(form, err.errors);
      showToast(err.message, 'error');
    }
  });

  document.body.appendChild(backdrop);
}

// ===== TAB 4: BAO MAT =====
function renderSecurityTab() {
  const host = document.getElementById('account-content');
  host.innerHTML = `
    <div class="panel">
      <h2 style="font-size:1.3rem;margin-bottom:16px;">Đổi mật khẩu</h2>
      <form id="pw-form" style="max-width:440px;" novalidate>
        <div class="form-group">
          <label class="form-label" for="pw-old">Mật khẩu hiện tại</label>
          <input id="pw-old" name="currentPassword" type="password" class="form-control" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="pw-new">Mật khẩu mới</label>
          <input id="pw-new" name="newPassword" type="password" class="form-control" required>
          <p class="form-hint">Tối thiểu 8 ký tự, gồm cả chữ và số.</p>
        </div>
        <div class="form-group">
          <label class="form-label" for="pw-confirm">Nhập lại mật khẩu mới</label>
          <input id="pw-confirm" name="confirmPassword" type="password" class="form-control" required>
        </div>
        <button type="submit" class="btn btn-primary">Cập nhật mật khẩu</button>
      </form>
    </div>
  `;

  const form = document.getElementById('pw-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldErrors(form, {});
    if (form.newPassword.value !== form.confirmPassword.value) {
      setFieldErrors(form, { confirmPassword: 'Mật khẩu nhập lại không khớp.' });
      return;
    }
    try {
      await api.put('/api/auth/password', {
        currentPassword: form.currentPassword.value,
        newPassword: form.newPassword.value,
      });
      form.reset();
      showToast('Đã đổi mật khẩu thành công.');
    } catch (err) {
      setFieldErrors(form, err.errors);
      showToast(err.message, 'error');
    }
  });
}

async function renderCurrentTab() {
  const tab = getActiveTab();
  updateNavActive(tab);
  const host = document.getElementById('account-content');
  host.innerHTML = '<div class="skeleton" style="height:260px;"></div>';

  try {
    if (tab === 'profile') await renderProfileTab();
    else if (tab === 'orders') await renderOrdersTab();
    else if (tab === 'addresses') await renderAddressesTab();
    else renderSecurityTab();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

(async () => {
  const auth = await initShopLayout('');
  if (!auth.user) {
    window.location.href = `/auth.html?redirect=${encodeURIComponent('account.html' + window.location.hash)}`;
    return;
  }
  if (auth.user.role !== 'customer') {
    window.location.href = '/admin/dashboard.html';
    return;
  }
  currentUser = auth.user;
  window.addEventListener('hashchange', renderCurrentTab);
  await renderCurrentTab();
})();
