import { api } from '../api.js';
import { initShopLayout } from '../layout.js';
import { escapeHTML, formatVND, showToast, setFieldErrors } from '../ui.js';
import { updateCartBadge } from '../cart-store.js';

let cartSummary = null;
let addresses = [];
let couponInfo = null;
let selectedAddressId = 'new';

function renderThankYou(order) {
  const root = document.getElementById('checkout-root');
  const bankBlock = order.paymentMethod === 'bank_transfer' ? `
    <div class="panel" style="background:#FFF8F2;border-color:var(--accent);margin-block:20px;text-align:left;">
      <h3 style="margin-bottom:8px;">Hướng dẫn chuyển khoản ngân hàng (tài khoản mẫu)</h3>
      <p style="margin-bottom:6px;">Ngân hàng: <strong>Vietcombank — Chi nhánh TP.HCM</strong></p>
      <p style="margin-bottom:6px;">Số tài khoản: <strong class="mono-label" style="font-size:0.95rem;color:var(--ink);">0071 0000 99887</strong></p>
      <p style="margin-bottom:6px;">Chủ tài khoản: <strong>CONG TY CA PHE NHA RANG</strong></p>
      <p style="margin-bottom:6px;">Số tiền: <strong>${formatVND(order.total)}</strong></p>
      <p style="margin:0;">Nội dung chuyển khoản: <strong class="mono-label" style="font-size:0.95rem;color:var(--accent);">${escapeHTML(order.orderCode)}</strong></p>
    </div>
  ` : '';

  root.innerHTML = `
    <div class="panel" style="max-width:680px;margin:var(--s5) auto var(--s7);">
      <p class="mono-label text-sage">ĐẶT HÀNG THÀNH CÔNG</p>
      <h2 style="margin-top:6px;">Cảm ơn bạn đã đặt hàng tại Nhà Rang!</h2>
      <p class="text-soft">Mã đơn hàng của bạn là <strong style="color:var(--ink);">${escapeHTML(order.orderCode)}</strong>. Chúng tôi sẽ xác nhận và chuẩn bị gói hạt mới nhất gửi tới bạn.</p>

      ${bankBlock}

      <div style="border-top:1px solid var(--line);padding-top:16px;margin-top:16px;">
        <h3 style="font-size:1rem;">Tóm tắt đơn hàng</h3>
        <p style="font-size:0.9rem;color:var(--ink-soft);">
          Người nhận: <strong>${escapeHTML(order.recipientName)}</strong> (${escapeHTML(order.phone)})<br>
          Địa chỉ: ${escapeHTML(order.shippingAddress)}
        </p>
        ${order.items.map((i) => `
          <div class="summary-row">
            <span>${escapeHTML(i.productName)} (${escapeHTML(i.variantLabel)}) × ${i.quantity}</span>
            <span class="tabular">${formatVND(i.lineTotal)}</span>
          </div>
        `).join('')}
        <div class="summary-row summary-total">
          <span>Tổng thanh toán</span>
          <span class="tabular">${formatVND(order.total)}</span>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;">
        <a class="btn btn-primary" href="/account.html#orders">Xem đơn hàng</a>
        <a class="btn btn-secondary" href="/products.html">Tiếp tục mua sắm</a>
      </div>
    </div>
  `;
}

function renderCheckoutForm() {
  const root = document.getElementById('checkout-root');
  const discount = couponInfo ? couponInfo.discountAmount : 0;
  const total = Math.max(0, cartSummary.subtotal + cartSummary.shippingFee - discount);

  root.innerHTML = `
    <form id="checkout-form" class="two-col-layout" novalidate>
      <div style="display:grid;gap:20px;">
        <div class="panel">
          <h2 style="font-size:1.2rem;margin-bottom:16px;">1. Địa chỉ giao hàng</h2>
          ${addresses.map((a) => `
            <label class="address-radio-card ${String(selectedAddressId) === String(a.id) ? 'selected' : ''}">
              <input type="radio" name="addressChoice" value="${a.id}" ${String(selectedAddressId) === String(a.id) ? 'checked' : ''}>
              <div>
                <strong>${escapeHTML(a.recipient_name)}</strong> · ${escapeHTML(a.phone)}
                ${a.is_default ? '<span class="pill pill-completed" style="margin-left:6px;">Mặc định</span>' : ''}
                <div class="text-soft" style="font-size:0.88rem;margin-top:4px;">
                  ${escapeHTML(a.street)}, ${escapeHTML(a.ward)}, ${escapeHTML(a.district)}, ${escapeHTML(a.province)}
                </div>
              </div>
            </label>
          `).join('')}

          <label class="address-radio-card ${selectedAddressId === 'new' ? 'selected' : ''}">
            <input type="radio" name="addressChoice" value="new" ${selectedAddressId === 'new' ? 'checked' : ''}>
            <strong>Giao tới địa chỉ mới</strong>
          </label>

          <div id="new-address-fields" class="${selectedAddressId === 'new' ? '' : 'hidden'}" style="margin-top:16px;">
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="co-name">Họ tên người nhận</label>
                <input id="co-name" name="recipientName" class="form-control">
              </div>
              <div class="form-group">
                <label class="form-label" for="co-phone">Số điện thoại</label>
                <input id="co-phone" name="phone" class="form-control" placeholder="0901234567">
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="co-prov">Tỉnh / Thành phố</label>
                <input id="co-prov" name="province" class="form-control" placeholder="TP. Hồ Chí Minh">
              </div>
              <div class="form-group">
                <label class="form-label" for="co-dist">Quận / Huyện</label>
                <input id="co-dist" name="district" class="form-control" placeholder="Quận 3">
              </div>
            </div>
            <div class="form-grid-2">
              <div class="form-group">
                <label class="form-label" for="co-ward">Phường / Xã</label>
                <input id="co-ward" name="ward" class="form-control" placeholder="Phường Võ Thị Sáu">
              </div>
              <div class="form-group">
                <label class="form-label" for="co-street">Số nhà, tên đường</label>
                <input id="co-street" name="street" class="form-control" placeholder="120 Pasteur">
              </div>
            </div>
            <label class="filter-option">
              <input type="checkbox" name="saveAddress" checked> Lưu địa chỉ này vào sổ địa chỉ của tôi
            </label>
          </div>
        </div>

        <div class="panel">
          <h2 style="font-size:1.2rem;margin-bottom:16px;">2. Phương thức thanh toán</h2>
          <label class="address-radio-card selected" id="pm-cod-card">
            <input type="radio" name="paymentMethod" value="cod" checked>
            <div>
              <strong>Thanh toán khi nhận hàng (COD)</strong>
              <div class="text-soft" style="font-size:0.86rem;">Trả tiền mặt trực tiếp cho nhân viên giao hàng.</div>
            </div>
          </label>
          <label class="address-radio-card" id="pm-bank-card">
            <input type="radio" name="paymentMethod" value="bank_transfer">
            <div>
              <strong>Chuyển khoản ngân hàng</strong>
              <div class="text-soft" style="font-size:0.86rem;">Chuyển khoản theo thông tin tài khoản cửa hàng, nhân viên sẽ xác nhận sau khi nhận tiền.</div>
            </div>
          </label>

          <div id="bank-info-preview" class="hidden" style="padding:12px 14px;background:#FFF8F2;border:1px solid var(--line);border-radius:var(--radius);font-size:0.88rem;margin-bottom:16px;">
            <strong>Thông tin chuyển khoản mẫu:</strong><br>
            Vietcombank · STK: <strong>0071 0000 99887</strong> · Chủ TK: <strong>CONG TY CA PHE NHA RANG</strong><br>
            Nội dung: Mã đơn hàng hiển thị ngay sau khi đặt.
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label" for="co-note">Ghi chú cho đơn hàng (tùy chọn)</label>
            <textarea id="co-note" name="note" class="form-control" placeholder="Ví dụ: Giao giờ hành chính, gọi trước 15 phút..."></textarea>
          </div>
        </div>
      </div>

      <aside class="panel">
        <h2 style="font-size:1.2rem;margin-bottom:16px;">Đơn hàng (${cartSummary.items.length} sản phẩm)</h2>
        <div style="display:grid;gap:10px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid var(--line);">
          ${cartSummary.items.map((i) => `
            <div class="summary-row" style="margin:0;">
              <span>${escapeHTML(i.productName)} <small class="text-soft">(${escapeHTML(i.variantLabel)} × ${i.quantity})</small></span>
              <span class="tabular">${formatVND(i.lineTotal)}</span>
            </div>
          `).join('')}
        </div>

        <div class="summary-row"><span class="text-soft">Tạm tính</span><span class="tabular">${formatVND(cartSummary.subtotal)}</span></div>
        <div class="summary-row"><span class="text-soft">Phí giao hàng</span><span class="tabular">${cartSummary.shippingFee === 0 ? 'Miễn phí' : formatVND(cartSummary.shippingFee)}</span></div>
        ${discount > 0 ? `<div class="summary-row text-sage"><span>Mã giảm giá (${escapeHTML(couponInfo.code)})</span><span class="tabular">-${formatVND(discount)}</span></div>` : ''}
        <div class="summary-row summary-total"><span>Tổng cộng</span><span class="tabular">${formatVND(total)}</span></div>

        <button type="submit" class="btn btn-primary btn-block" id="btn-place-order" style="margin-top:20px;">Đặt hàng</button>
      </aside>
    </form>
  `;

  const form = document.getElementById('checkout-form');
  form.querySelectorAll('input[name="addressChoice"]').forEach((r) => {
    r.addEventListener('change', () => {
      selectedAddressId = r.value;
      document.getElementById('new-address-fields').classList.toggle('hidden', selectedAddressId !== 'new');
      form.querySelectorAll('.address-radio-card').forEach((card) => {
        const inp = card.querySelector('input[name="addressChoice"]');
        if (inp) card.classList.toggle('selected', inp.checked);
      });
    });
  });

  form.querySelectorAll('input[name="paymentMethod"]').forEach((r) => {
    r.addEventListener('change', () => {
      document.getElementById('bank-info-preview').classList.toggle('hidden', r.value !== 'bank_transfer');
      document.getElementById('pm-cod-card').classList.toggle('selected', r.value === 'cod');
      document.getElementById('pm-bank-card').classList.toggle('selected', r.value === 'bank_transfer');
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldErrors(form, {});
    const submitBtn = document.getElementById('btn-place-order');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang xử lý đơn hàng...';

    const payload = {
      paymentMethod: form.querySelector('input[name="paymentMethod"]:checked').value,
      note: form.note.value.trim(),
      couponCode: couponInfo ? couponInfo.code : '',
    };

    if (selectedAddressId !== 'new') {
      payload.addressId = Number(selectedAddressId);
    } else {
      payload.recipientName = form.recipientName.value.trim();
      payload.phone = form.phone.value.trim();
      payload.province = form.province.value.trim();
      payload.district = form.district.value.trim();
      payload.ward = form.ward.value.trim();
      payload.street = form.street.value.trim();
      payload.saveAddress = form.saveAddress.checked;
    }

    try {
      const order = await api.post('/api/orders', payload);
      sessionStorage.removeItem('nr_coupon_code');
      sessionStorage.setItem('nr_last_order', JSON.stringify(order));
      updateCartBadge(0);
      renderThankYou(order);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setFieldErrors(form, err.errors);
      showToast(err.message, 'error');
      if (err.status === 409) {
        setTimeout(() => { window.location.href = '/cart.html'; }, 1800);
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Đặt hàng';
    }
  });
}

(async () => {
  const auth = await initShopLayout('');
  const user = auth.user;
  if (!user) {
    window.location.href = '/auth.html?redirect=checkout.html';
    return;
  }
  if (user.role !== 'customer') {
    window.location.href = '/admin/dashboard.html';
    return;
  }

  try {
    cartSummary = await api.get('/api/cart', { redirectOn401: true });
    if (cartSummary.items.length === 0) {
      // Neu vua dat don thanh cong va tai lai trang, hien lai man hinh cam on (khong dat them don)
      const lastOrderRaw = sessionStorage.getItem('nr_last_order');
      if (lastOrderRaw) {
        renderThankYou(JSON.parse(lastOrderRaw));
        return;
      }
      window.location.href = '/cart.html';
      return;
    }
    sessionStorage.removeItem('nr_last_order');
    if (cartSummary.hasUnavailable) {
      showToast('Giỏ hàng có sản phẩm không khả dụng, vui lòng kiểm tra lại.', 'warn');
      window.location.href = '/cart.html';
      return;
    }

    addresses = await api.get('/api/account/addresses');
    const defAddr = addresses.find((a) => a.is_default) || addresses[0];
    selectedAddressId = defAddr ? String(defAddr.id) : 'new';

    const savedCode = sessionStorage.getItem('nr_coupon_code');
    if (savedCode) {
      try {
        couponInfo = await api.post('/api/coupons/validate', { code: savedCode });
      } catch {
        sessionStorage.removeItem('nr_coupon_code');
      }
    }

    renderCheckoutForm();
  } catch (err) {
    showToast(err.message, 'error');
  }
})();
