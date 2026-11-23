import { api } from '../api.js';
import { initAdminLayout } from '../layout.js';
import {
  escapeHTML, formatVND, formatDate, formatDateTime,
  renderStatusPill, renderPaymentPill, STATUS_LABELS,
  PAYMENT_METHOD_LABELS, renderPagination, focusResults, renderErrorState,
  showToast, confirmDialog,
} from '../ui.js';

let currentUser = null;
let activeTab = 'orders';
let orderFilter = { status: '', q: '', dateFrom: '', dateTo: '', page: 1 };
let customerFilter = { q: '', page: 1 };

async function loadOrdersTab() {
  const root = document.getElementById('admin-orders-root');
  const qs = new URLSearchParams({ page: String(orderFilter.page), pageSize: '8' });
  if (orderFilter.status) qs.set('status', orderFilter.status);
  if (orderFilter.q) qs.set('q', orderFilter.q);
  if (orderFilter.dateFrom) qs.set('dateFrom', orderFilter.dateFrom);
  if (orderFilter.dateTo) qs.set('dateTo', orderFilter.dateTo);

  try {
    const data = await api.get(`/api/admin/orders?${qs.toString()}`, { redirectOn401: true });
    const sc = data.statusCounts || {};
    const chips = [
      ['', `Tất cả (${sc.all || 0})`],
      ['pending', `Chờ xử lý (${sc.pending || 0})`],
      ['confirmed', `Đã xác nhận (${sc.confirmed || 0})`],
      ['shipping', `Đang giao (${sc.shipping || 0})`],
      ['completed', `Hoàn tất (${sc.completed || 0})`],
      ['cancelled', `Đã hủy (${sc.cancelled || 0})`],
    ];

    root.innerHTML = `
      <div class="panel" style="padding:14px;margin-bottom:16px;display:grid;gap:12px;">
        <div class="chip-row">
          ${chips.map(([val, label]) => `
            <button type="button" class="filter-chip ${orderFilter.status === val ? 'active' : ''}" data-status-chip="${val}">${label}</button>
          `).join('')}
        </div>
        <form id="order-filter-form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <input name="q" class="form-control" style="max-width:260px;min-height:38px;" placeholder="Mã đơn, tên khách, SĐT..." value="${escapeHTML(orderFilter.q)}">
          <input name="dateFrom" type="date" class="form-control" style="max-width:160px;min-height:38px;" value="${escapeHTML(orderFilter.dateFrom)}">
          <input name="dateTo" type="date" class="form-control" style="max-width:160px;min-height:38px;" value="${escapeHTML(orderFilter.dateTo)}">
          <button type="submit" class="btn btn-secondary btn-sm">Lọc</button>
        </form>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Ngày đặt</th>
              <th style="text-align:right;">Tổng tiền</th>
              <th>Thanh toán</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((o) => `
              <tr class="clickable" data-open-order="${escapeHTML(o.order_code)}">
                <td class="mono-label" style="color:var(--ink);font-weight:600;">${escapeHTML(o.order_code)}</td>
                <td>
                  <strong>${escapeHTML(o.recipient_name)}</strong>
                  <div class="text-soft" style="font-size:0.8rem;">${escapeHTML(o.phone)}</div>
                </td>
                <td>${formatDateTime(o.created_at)}</td>
                <td class="tabular" style="text-align:right;font-weight:600;">${formatVND(o.total)}</td>
                <td>
                  ${renderPaymentPill(o.payment_status)}
                  <div class="text-soft" style="font-size:0.76rem;margin-top:2px;">${o.payment_method === 'cod' ? 'COD' : 'Chuyển khoản'}</div>
                </td>
                <td>${renderStatusPill(o.status)}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="text-soft">Không tìm thấy đơn hàng nào.</td></tr>'}
          </tbody>
        </table>
      </div>
      ${renderPagination(data.page, data.totalPages)}
    `;

    root.querySelectorAll('[data-status-chip]').forEach((b) => {
      b.addEventListener('click', () => {
        orderFilter.status = b.dataset.statusChip;
        orderFilter.page = 1;
        loadOrdersTab();
      });
    });

    document.getElementById('order-filter-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      orderFilter.q = f.q.value.trim();
      orderFilter.dateFrom = f.dateFrom.value;
      orderFilter.dateTo = f.dateTo.value;
      orderFilter.page = 1;
      loadOrdersTab();
    });

    root.querySelectorAll('[data-page]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        orderFilter.page = Number(b.dataset.page);
        await loadOrdersTab();
        focusResults(root);
      });
    });

    root.querySelectorAll('[data-open-order]').forEach((tr) => {
      tr.addEventListener('click', () => openAdminOrderDrawer(tr.dataset.openOrder));
    });
  } catch (err) {
    root.innerHTML = renderErrorState(err.message, 'retry-aord');
    document.getElementById('retry-aord')?.addEventListener('click', loadOrdersTab);
  }
}

async function openAdminOrderDrawer(code) {
  try {
    const o = await api.get(`/api/admin/orders/${encodeURIComponent(code)}`);
    const host = document.getElementById('admin-drawer-host');
    const nextStatuses = o.allowedNextStatuses || [];
    const btnLabels = {
      confirmed: 'Xác nhận đơn',
      shipping: 'Chuyển đang giao',
      completed: 'Đánh dấu hoàn tất',
      cancelled: 'Hủy đơn hàng',
    };

    host.innerHTML = `
      <div class="drawer-backdrop" id="ord-drawer-bd">
        <div class="drawer-panel print-area" role="dialog" aria-modal="true">
          <div class="modal-head">
            <div>
              <span class="mono-label">PHIẾU ĐƠN HÀNG NHÀ RANG</span>
              <h3 style="margin:4px 0 0;">${escapeHTML(o.order_code)}</h3>
            </div>
            <div style="display:flex;gap:8px;" class="no-print">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-print-order">In phiếu</button>
              <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
            </div>
          </div>

          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
            ${renderStatusPill(o.status)}
            ${renderPaymentPill(o.payment_status)}
            <span class="pill pill-unpaid">${escapeHTML(PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method)}</span>
          </div>

          <div style="padding:12px;background:var(--bg);border-radius:6px;margin-bottom:16px;">
            <strong>${escapeHTML(o.recipient_name)}</strong> · ${escapeHTML(o.phone)}<br>
            ${escapeHTML(o.shipping_address)}<br>
            <span class="text-soft">Tài khoản: ${escapeHTML(o.customer_name)} (${escapeHTML(o.customer_email)})</span>
            ${o.note ? `<div style="margin-top:6px;"><strong>Ghi chú:</strong> ${escapeHTML(o.note)}</div>` : ''}
          </div>

          <div class="table-wrap" style="margin-bottom:14px;">
            <table class="data-table">
              <thead><tr><th>Sản phẩm</th><th style="text-align:right;">SL</th><th style="text-align:right;">Thành tiền</th></tr></thead>
              <tbody>
                ${o.items.map((i) => `
                  <tr>
                    <td>
                      <strong>${escapeHTML(i.product_name)}</strong>
                      <div class="text-soft" style="font-size:0.8rem;">${escapeHTML(i.variant_label)} · ${formatVND(i.unit_price)}</div>
                    </td>
                    <td class="tabular" style="text-align:right;">${i.quantity}</td>
                    <td class="tabular" style="text-align:right;font-weight:600;">${formatVND(i.line_total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="summary-row"><span class="text-soft">Tạm tính</span><span class="tabular">${formatVND(o.subtotal)}</span></div>
          <div class="summary-row"><span class="text-soft">Phí giao hàng</span><span class="tabular">${o.shipping_fee === 0 ? 'Miễn phí' : formatVND(o.shipping_fee)}</span></div>
          ${o.discount_amount > 0 ? `<div class="summary-row text-sage"><span>Giảm giá ${o.coupon_code ? `(${escapeHTML(o.coupon_code)})` : ''}</span><span class="tabular">-${formatVND(o.discount_amount)}</span></div>` : ''}
          <div class="summary-row summary-total"><span>Tổng cộng</span><span class="tabular">${formatVND(o.total)}</span></div>

          <div class="no-print" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line);">
            ${o.payment_method === 'bank_transfer' && o.payment_status === 'unpaid' && o.status !== 'cancelled' ? `
              <button type="button" class="btn btn-secondary btn-sm" id="btn-mark-paid" style="margin-bottom:14px;">
                Đánh dấu đã thanh toán chuyển khoản
              </button>
            ` : ''}

            ${nextStatuses.length > 0 ? `
              <div class="form-group">
                <label class="form-label" for="status-note">Ghi chú cập nhật trạng thái (tùy chọn)</label>
                <input id="status-note" class="form-control" placeholder="Ví dụ: Đã giao cho GHN, mã vận đơn...">
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${nextStatuses.map((st) => `
                  <button type="button" class="btn ${st === 'cancelled' ? 'btn-danger' : 'btn-primary'} btn-sm" data-next-status="${st}">
                    ${btnLabels[st] || st}
                  </button>
                `).join('')}
              </div>
            ` : '<p class="text-soft">Đơn hàng đã ở trạng thái cuối, không thể thay đổi thêm.</p>'}
          </div>

          <h4 style="font-family:var(--font-body);font-size:0.95rem;margin-top:24px;">Lịch sử trạng thái</h4>
          <ul class="timeline">
            ${o.history.map((h) => `
              <li>
                <strong>${escapeHTML(STATUS_LABELS[h.to_status] || h.to_status)}</strong>
                <div class="text-soft" style="font-size:0.8rem;">${formatDateTime(h.created_at)} ${h.actor_name ? `· ${escapeHTML(h.actor_name)}` : ''}</div>
                ${h.note ? `<div style="font-size:0.85rem;">${escapeHTML(h.note)}</div>` : ''}
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
    `;

    const close = () => { document.removeEventListener('keydown', onEsc); host.innerHTML = ''; };
    const onEsc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onEsc);
    host.querySelector('#ord-drawer-bd').addEventListener('click', (e) => {
      if (e.target.id === 'ord-drawer-bd' || e.target.closest('[data-close]')) close();
    });

    document.getElementById('btn-print-order').addEventListener('click', () => window.print());

    document.getElementById('btn-mark-paid')?.addEventListener('click', async () => {
      try {
        await api.patch(`/api/admin/orders/${encodeURIComponent(o.order_code)}/payment`, { paymentStatus: 'paid' });
        showToast('Đã xác nhận thanh toán chuyển khoản.');
        openAdminOrderDrawer(o.order_code);
        loadOrdersTab();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    host.querySelectorAll('[data-next-status]').forEach((b) => {
      b.addEventListener('click', async () => {
        const nextSt = b.dataset.nextStatus;
        if (nextSt === 'cancelled') {
          const ok = await confirmDialog({
            title: 'Xác nhận hủy đơn',
            message: `Hủy đơn ${o.order_code} sẽ hoàn lại tồn kho cho các sản phẩm trong đơn.`,
            confirmText: 'Hủy đơn',
          });
          if (!ok) return;
        }
        try {
          const note = document.getElementById('status-note')?.value.trim() || '';
          await api.patch(`/api/admin/orders/${encodeURIComponent(o.order_code)}/status`, { status: nextSt, note });
          showToast(`Đã cập nhật đơn sang "${STATUS_LABELS[nextSt]}".`);
          openAdminOrderDrawer(o.order_code);
          loadOrdersTab();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadCustomersTab() {
  const root = document.getElementById('admin-orders-root');
  const canManageUsers = currentUser.permissions.includes('users:manage');
  const qs = new URLSearchParams({ page: String(customerFilter.page), pageSize: '8' });
  if (customerFilter.q) qs.set('q', customerFilter.q);

  try {
    const data = await api.get(`/api/admin/customers?${qs.toString()}`, { redirectOn401: true });
    root.innerHTML = `
      <div class="panel" style="padding:14px;margin-bottom:16px;">
        <form id="cust-filter-form" style="display:flex;gap:10px;align-items:center;">
          <input name="q" class="form-control" style="max-width:300px;min-height:38px;" placeholder="Tìm tên, email, số điện thoại..." value="${escapeHTML(customerFilter.q)}">
          <button type="submit" class="btn btn-secondary btn-sm">Tìm kiếm</button>
        </form>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Khách hàng</th>
              <th>SĐT</th>
              <th style="text-align:right;">Số đơn</th>
              <th style="text-align:right;">Tổng chi tiêu</th>
              <th style="text-align:right;">Điểm</th>
              <th>Trạng thái</th>
              ${canManageUsers ? '<th>Thao tác</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${data.items.map((c) => `
              <tr class="clickable" data-open-cust="${c.id}">
                <td>
                  <strong>${escapeHTML(c.full_name)}</strong>
                  <div class="text-soft" style="font-size:0.8rem;">${escapeHTML(c.email)}</div>
                </td>
                <td>${escapeHTML(c.phone || '—')}</td>
                <td class="tabular" style="text-align:right;">${c.order_count}</td>
                <td class="tabular" style="text-align:right;font-weight:600;">${formatVND(c.total_spent)}</td>
                <td class="tabular" style="text-align:right;">${c.loyalty_points}</td>
                <td>
                  <span class="pill ${c.status === 'active' ? 'pill-completed' : 'pill-cancelled'}">
                    ${c.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                  </span>
                </td>
                ${canManageUsers ? `
                  <td onclick="event.stopPropagation();">
                    <button type="button" class="btn ${c.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm"
                            data-toggle-user="${c.id}" data-next-st="${c.status === 'active' ? 'blocked' : 'active'}" data-uname="${escapeHTML(c.full_name)}">
                      ${c.status === 'active' ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </td>
                ` : ''}
              </tr>
            `).join('') || '<tr><td colspan="7" class="text-soft">Không tìm thấy khách hàng.</td></tr>'}
          </tbody>
        </table>
      </div>
      ${renderPagination(data.page, data.totalPages)}
    `;

    document.getElementById('cust-filter-form').addEventListener('submit', (e) => {
      e.preventDefault();
      customerFilter.q = e.target.q.value.trim();
      customerFilter.page = 1;
      loadCustomersTab();
    });

    root.querySelectorAll('[data-page]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        customerFilter.page = Number(b.dataset.page);
        await loadCustomersTab();
        focusResults(root);
      });
    });

    root.querySelectorAll('[data-open-cust]').forEach((tr) => {
      tr.addEventListener('click', () => openCustomerDetailDrawer(Number(tr.dataset.openCust)));
    });

    root.querySelectorAll('[data-toggle-user]').forEach((b) => {
      b.addEventListener('click', async () => {
        const nextSt = b.dataset.nextSt;
        const ok = await confirmDialog({
          title: nextSt === 'blocked' ? 'Khóa tài khoản khách hàng' : 'Mở khóa tài khoản',
          message: nextSt === 'blocked'
            ? `Khách hàng "${b.dataset.uname}" sẽ bị đăng xuất và không thể đăng nhập lại.`
            : `Cho phép "${b.dataset.uname}" đăng nhập trở lại?`,
          confirmText: nextSt === 'blocked' ? 'Khóa tài khoản' : 'Mở khóa',
          danger: nextSt === 'blocked',
        });
        if (!ok) return;
        try {
          await api.patch(`/api/admin/customers/${b.dataset.toggleUser}/status`, { status: nextSt });
          showToast(nextSt === 'blocked' ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
          loadCustomersTab();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    root.innerHTML = renderErrorState(err.message, 'retry-acust');
    document.getElementById('retry-acust')?.addEventListener('click', loadCustomersTab);
  }
}

async function openCustomerDetailDrawer(id) {
  try {
    const c = await api.get(`/api/admin/customers/${id}`);
    const host = document.getElementById('admin-drawer-host');
    host.innerHTML = `
      <div class="drawer-backdrop" id="cust-drawer-bd">
        <div class="drawer-panel" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3>${escapeHTML(c.full_name)}</h3>
            <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
          </div>
          <p class="text-soft" style="margin-bottom:16px;">
            Email: <strong>${escapeHTML(c.email)}</strong><br>
            SĐT: ${escapeHTML(c.phone || '—')} · Điểm tích lũy: <strong>${c.loyalty_points}</strong><br>
            Ngày tham gia: ${formatDate(c.created_at)}
          </p>
          <h4 style="font-family:var(--font-body);font-size:0.95rem;margin-bottom:10px;">5 đơn hàng gần nhất</h4>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Mã đơn</th><th>Ngày</th><th>Trạng thái</th><th style="text-align:right;">Tổng</th></tr></thead>
              <tbody>
                ${c.recentOrders.map((o) => `
                  <tr class="clickable" data-jump-order="${escapeHTML(o.order_code)}">
                    <td class="mono-label">${escapeHTML(o.order_code)}</td>
                    <td>${formatDate(o.created_at)}</td>
                    <td>${renderStatusPill(o.status)}</td>
                    <td class="tabular" style="text-align:right;">${formatVND(o.total)}</td>
                  </tr>
                `).join('') || '<tr><td colspan="4" class="text-soft">Khách chưa có đơn hàng nào.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    const close = () => { host.innerHTML = ''; };
    host.querySelector('#cust-drawer-bd').addEventListener('click', (e) => {
      if (e.target.id === 'cust-drawer-bd' || e.target.closest('[data-close]')) close();
    });
    host.querySelectorAll('[data-jump-order]').forEach((tr) => {
      tr.addEventListener('click', () => openAdminOrderDrawer(tr.dataset.jumpOrder));
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function switchAdminTab(tab) {
  activeTab = tab;
  document.getElementById('tab-admin-orders').classList.toggle('active', tab === 'orders');
  document.getElementById('tab-admin-customers').classList.toggle('active', tab === 'customers');
  if (tab === 'orders') loadOrdersTab();
  else loadCustomersTab();
}

(async () => {
  currentUser = await initAdminLayout('orders');
  if (!currentUser) return;
  document.getElementById('admin-page-heading').textContent = 'Đơn hàng & Khách hàng';

  const sp = new URLSearchParams(window.location.search);
  if (sp.get('status')) orderFilter.status = sp.get('status');

  document.getElementById('tab-admin-orders').addEventListener('click', () => switchAdminTab('orders'));
  document.getElementById('tab-admin-customers').addEventListener('click', () => switchAdminTab('customers'));

  await loadOrdersTab();
  if (sp.get('code')) {
    openAdminOrderDrawer(sp.get('code'));
  }
})();
