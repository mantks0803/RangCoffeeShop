import { api } from './api.js';
import { escapeHTML, showToast } from './ui.js';
import { getGuestCart, countItems, updateCartBadge } from './cart-store.js';

let cachedAuth = null;

export async function getCurrentAuth(force = false) {
  if (!force && cachedAuth) return cachedAuth;
  try {
    cachedAuth = await api.get('/api/auth/me');
  } catch {
    cachedAuth = { user: null, showDemoHint: false };
  }
  return cachedAuth;
}

// Dung header va footer dung chung cho cac trang cua hang
export async function initShopLayout(activeNav = '') {
  const auth = await getCurrentAuth(true);
  const user = auth.user;

  const topButton = document.createElement('button');
  topButton.type = 'button';
  topButton.className = 'back-to-top';
  topButton.setAttribute('aria-label', 'Về đầu trang');
  topButton.title = 'Về đầu trang';
  topButton.innerHTML = '<span aria-hidden="true">↑</span>';
  const syncTopButton = () => {
    topButton.hidden = window.scrollY < Math.max(400, window.innerHeight * 0.75);
  };
  syncTopButton();
  document.body.append(topButton);
  window.addEventListener('scroll', syncTopButton, { passive: true });
  window.addEventListener('resize', syncTopButton);
  topButton.addEventListener('click', () => {
    document.querySelector('.brand-link')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  });

  const headerHost = document.getElementById('site-header');
  if (headerHost) {
    headerHost.className = 'site-header';
    headerHost.innerHTML = `
      <div class="container header-inner">
        <a class="brand-link" href="/index.html" aria-label="Nhà Rang — Trang chủ">
          <img src="/assets/logo.svg" alt="Nhà Rang" width="144" height="32">
        </a>
        <nav class="main-nav" aria-label="Điều hướng chính">
          <a href="/index.html" class="${activeNav === 'home' ? 'active' : ''}">Trang chủ</a>
          <a href="/products.html" class="${activeNav === 'shop' ? 'active' : ''}">Cửa hàng</a>
        </nav>
        <form class="header-search" id="desktop-search-form" role="search">
          <label class="sr-only" for="desktop-search-input">Tìm sản phẩm</label>
          <input id="desktop-search-input" type="search" name="q" placeholder="Tìm cà phê, phễu V60, cốc gốm...">
          <button type="submit" aria-label="Tìm kiếm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          </button>
        </form>
        <div class="header-actions">
          <a class="icon-btn" href="/cart.html" aria-label="Giỏ hàng">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 6h15l-1.5 9h-12z"/><path d="M6 6L5 3H2"/><circle cx="9.5" cy="19.5" r="1.5"/><circle cx="17.5" cy="19.5" r="1.5"/></svg>
            <span class="cart-badge hidden" id="header-cart-badge">0</span>
          </a>
          <div id="header-user-slot"></div>
        </div>
      </div>
      <form class="mobile-menu-bar" id="mobile-search-form" role="search">
        <a class="btn btn-ghost btn-sm" href="/products.html">Cửa hàng</a>
        <input type="search" name="q" placeholder="Tìm cà phê, dụng cụ...">
      </form>
    `;

    // Gan su kien tim kiem -> chuyen sang products.html?q=...
    const bindSearch = (formId) => {
      const form = document.getElementById(formId);
      if (!form) return;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = form.querySelector('input[name="q"]').value.trim();
        window.location.href = q ? `/products.html?q=${encodeURIComponent(q)}` : '/products.html';
      });
    };
    bindSearch('desktop-search-form');
    bindSearch('mobile-search-form');

    // Khu vuc tai khoan
    const userSlot = document.getElementById('header-user-slot');
    if (!user) {
      userSlot.innerHTML = `<a class="btn btn-secondary btn-sm" href="/auth.html">Đăng nhập</a>`;
    } else {
      const shortName = user.fullName.split(' ').slice(-2).join(' ');
      userSlot.innerHTML = `
        <div class="user-menu-wrap">
          <button type="button" class="icon-btn" id="user-menu-btn" aria-expanded="false" aria-haspopup="true">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>
            <span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHTML(shortName)}</span>
          </button>
          <div class="user-dropdown hidden" id="user-dropdown" role="menu">
            ${user.role === 'customer' ? `
              <a href="/account.html#profile">Hồ sơ tài khoản</a>
              <a href="/account.html#orders">Đơn hàng của tôi</a>
            ` : ''}
            ${user.role === 'admin' ? `<a href="/admin/dashboard.html">Trang quản trị</a>` : ''}
            <button type="button" id="logout-btn" class="text-danger">Đăng xuất</button>
          </div>
        </div>
      `;
      const menuBtn = document.getElementById('user-menu-btn');
      const dropdown = document.getElementById('user-dropdown');
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdown.classList.toggle('hidden');
        menuBtn.setAttribute('aria-expanded', String(!isHidden));
      });
      document.addEventListener('click', () => dropdown.classList.add('hidden'));
      document.getElementById('logout-btn').addEventListener('click', async () => {
        await api.post('/api/auth/logout', {});
        showToast('Đã đăng xuất.');
        window.location.href = '/index.html';
      });
    }
  }

  // Cap nhat badge gio hang
  if (user && user.role === 'customer') {
    api.get('/api/cart').then((s) => updateCartBadge(countItems(s.items))).catch(() => {});
  } else {
    updateCartBadge(countItems(getGuestCart()));
  }

  // Dung footer dung chung
  const footerHost = document.getElementById('site-footer');
  if (footerHost) {
    footerHost.className = 'site-footer';
    footerHost.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <h3>Nhà Rang</h3>
            <p>Cà phê rang nhỏ mẻ, pha ngon ngay tại nhà. Hạt tuyển chọn từ Cầu Đất, Buôn Ma Thuột, Khe Sanh và Sơn La, rang mới mỗi tuần.</p>
          </div>
          <div>
            <h3>Giao hàng & Đổi trả</h3>
            <ul>
              <li>Phí giao hàng đồng giá 30.000 ₫, miễn phí cho đơn từ 500.000 ₫.</li>
              <li>Giao nội thành trong 24 giờ, liên tỉnh từ 2 đến 4 ngày làm việc.</li>
              <li>Đổi trả trong 7 ngày với dụng cụ lỗi kỹ thuật hoặc gói cà phê rách niêm phong.</li>
            </ul>
          </div>
          <div>
            <h3>Liên hệ (dữ liệu mẫu)</h3>
            <ul>
              <li>Xưởng rang: 42 Đường Giả Định, Phường 6, Quận 3, TP. Hồ Chí Minh</li>
              <li>Điện thoại: 028 0000 1234 (8:30 – 18:00, Thứ 2 – Thứ 7)</li>
              <li>Email: lienhe@nharang.example</li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© 2026 Nhà Rang — Đồ án thương mại điện tử.</span>
          <span>Thanh toán hỗ trợ COD và chuyển khoản ngân hàng.</span>
        </div>
      </div>
    `;
  }

  return auth;
}

// Dung khung quan tri dung chung cho 3 trang admin
export async function initAdminLayout(activePage) {
  const auth = await getCurrentAuth(true);
  const user = auth.user;

  if (!user || user.role !== 'admin') {
    sessionStorage.setItem('nr_flash', 'Bạn cần đăng nhập tài khoản quản trị để truy cập khu vực này.');
    window.location.href = '/index.html';
    return null;
  }

  const levelLabels = { owner: 'Chủ cửa hàng (Owner)', manager: 'Quản lý (Manager)', staff: 'Nhân viên (Staff)' };
  const sidebarHost = document.getElementById('admin-sidebar');
  if (sidebarHost) {
    sidebarHost.innerHTML = `
      <div style="padding: 4px 12px 16px; border-bottom: 1px solid rgba(255,253,249,0.12); margin-bottom: 8px;">
        <div style="font-family:var(--font-display);font-size:1.25rem;color:#FFFDF9;">Nhà Rang</div>
        <div class="mono-label" style="color:#BFB1A1;margin-top:4px;">QUẢN TRỊ HỆ THỐNG</div>
      </div>
      <a href="/admin/dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}">Tổng quan</a>
      <a href="/admin/products.html" class="${activePage === 'products' ? 'active' : ''}">Sản phẩm & Danh mục</a>
      <a href="/admin/orders.html" class="${activePage === 'orders' ? 'active' : ''}">Đơn hàng & Khách hàng</a>
      <div style="margin-top:auto; padding-top:16px; border-top:1px solid rgba(255,253,249,0.12); display:grid; gap:6px;">
        <a href="/index.html">← Về cửa hàng</a>
        <button type="button" id="admin-logout-btn" style="color:#F2B8AD;">Đăng xuất</button>
      </div>
    `;
    document.getElementById('admin-logout-btn')?.addEventListener('click', async () => {
      await api.post('/api/auth/logout', {});
      window.location.href = '/index.html';
    });
  }

  const topbarHost = document.getElementById('admin-topbar');
  if (topbarHost) {
    topbarHost.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <button type="button" class="btn btn-secondary btn-sm mobile-filter-btn" id="admin-menu-toggle" aria-label="Mở menu quản trị">Menu</button>
        <strong id="admin-page-heading">Quản trị</strong>
      </div>
      <div style="text-align:right;">
        <div style="font-weight:600;">${escapeHTML(user.fullName)}</div>
        <div class="mono-label" style="font-size:0.7rem;">${escapeHTML(levelLabels[user.adminLevel] || user.adminLevel)}</div>
      </div>
    `;
    document.getElementById('admin-menu-toggle')?.addEventListener('click', () => {
      sidebarHost?.classList.toggle('open');
    });
  }

  return user;
}
