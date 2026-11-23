import { api } from '../api.js';
import { initShopLayout } from '../layout.js';
import { escapeHTML, showToast, setFieldErrors } from '../ui.js';
import { mergeGuestCartAfterLogin } from '../cart-store.js';

// Chi chap nhan redirect toi cac trang noi bo (tranh loi open redirect)
const ALLOWED_REDIRECT_PAGES = [
  'index.html', 'products.html', 'product.html', 'cart.html',
  'checkout.html', 'account.html', 'admin/dashboard.html',
  'admin/products.html', 'admin/orders.html',
];

function getSafeRedirect(user) {
  const raw = new URLSearchParams(window.location.search).get('redirect') || '';
  const clean = raw.replace(/^\/+/, '');
  const basePage = clean.split(/[?#]/)[0];
  if (clean && !clean.includes('://') && !clean.startsWith('//') && ALLOWED_REDIRECT_PAGES.includes(basePage)) {
    return `/${clean}`;
  }
  return user.role === 'admin' ? '/admin/dashboard.html' : '/index.html';
}

function switchTab(mode) {
  const isRegister = mode === 'register';
  document.getElementById('tab-login').classList.toggle('active', !isRegister);
  document.getElementById('tab-register').classList.toggle('active', isRegister);
  document.getElementById('tab-login').setAttribute('aria-selected', String(!isRegister));
  document.getElementById('tab-register').setAttribute('aria-selected', String(isRegister));

  document.getElementById('login-form').classList.toggle('hidden', isRegister);
  document.getElementById('register-form').classList.toggle('hidden', !isRegister);
  document.getElementById('auth-heading').textContent = isRegister ? 'Tạo tài khoản khách hàng' : 'Đăng nhập Nhà Rang';
  window.location.hash = isRegister ? '#register' : '#login';
}

function renderDemoAccounts() {
  const box = document.getElementById('demo-accounts-box');
  const list = document.getElementById('demo-accounts-list');
  box.classList.remove('hidden');

  const accounts = [
    { label: 'Khách demo', email: 'khach@nharang.vn', pass: 'Khach@123' },
    { label: 'Khách bị khóa (thử lỗi)', email: 'biloc@nharang.vn', pass: 'Khach@123' },
    { label: 'Admin Owner (toàn quyền)', email: 'admin@nharang.vn', pass: 'Admin@123' },
    { label: 'Admin Manager (sản phẩm)', email: 'quanly@nharang.vn', pass: 'Admin@123' },
    { label: 'Admin Staff (chỉ xem SP)', email: 'nhanvien@nharang.vn', pass: 'Admin@123' },
  ];

  list.innerHTML = accounts.map((a) => `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);font-size:0.84rem;">
      <div>
        <strong>${escapeHTML(a.label)}</strong><br>
        <span class="mono-label" style="text-transform:none;">${escapeHTML(a.email)} / ${escapeHTML(a.pass)}</span>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" data-fill-email="${escapeHTML(a.email)}" data-fill-pass="${escapeHTML(a.pass)}">Điền</button>
    </div>
  `).join('');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fill-email]');
    if (!btn) return;
    switchTab('login');
    document.getElementById('login-email').value = btn.dataset.fillEmail;
    document.getElementById('login-password').value = btn.dataset.fillPass;
    document.getElementById('login-email').focus();
  });
}

(async () => {
  const auth = await initShopLayout('');
  if (auth.user) {
    window.location.href = auth.user.role === 'admin' ? '/admin/dashboard.html' : '/index.html';
    return;
  }

  if (auth.showDemoHint) renderDemoAccounts();

  if (window.location.hash === '#register') switchTab('register');
  else switchTab('login');

  document.getElementById('tab-login').addEventListener('click', () => switchTab('login'));
  document.getElementById('tab-register').addEventListener('click', () => switchTab('register'));

  // Nut hien / an mat khau
  const pwInput = document.getElementById('login-password');
  const toggleBtn = document.getElementById('toggle-login-pw');
  toggleBtn.addEventListener('click', () => {
    const isPw = pwInput.type === 'password';
    pwInput.type = isPw ? 'text' : 'password';
    toggleBtn.textContent = isPw ? 'Ẩn' : 'Hiện';
  });

  // Xu ly dang nhap
  const loginForm = document.getElementById('login-form');
  const loginErr = document.getElementById('login-error');
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErr.classList.add('hidden');
    const btn = document.getElementById('login-submit');
    btn.disabled = true;
    try {
      const data = await api.post('/api/auth/login', {
        email: loginForm.email.value.trim(),
        password: loginForm.password.value,
      });
      if (data.user.role === 'customer') {
        await mergeGuestCartAfterLogin();
      }
      window.location.href = getSafeRedirect(data.user);
    } catch (err) {
      loginErr.textContent = err.message;
      loginErr.classList.remove('hidden');
      btn.disabled = false;
    }
  });

  // Xu ly dang ky
  const regForm = document.getElementById('register-form');
  const regErr = document.getElementById('register-error');
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regErr.classList.add('hidden');
    setFieldErrors(regForm, {});

    const fullName = regForm.fullName.value.trim();
    const email = regForm.email.value.trim();
    const phone = regForm.phone.value.trim();
    const password = regForm.password.value;
    const confirmPassword = regForm.confirmPassword.value;

    const clientErrors = {};
    if (fullName.length < 2) clientErrors.fullName = 'Vui lòng nhập họ tên tối thiểu 2 ký tự.';
    if (!email.includes('@')) clientErrors.email = 'Email không đúng định dạng.';
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      clientErrors.password = 'Mật khẩu tối thiểu 8 ký tự, gồm cả chữ và số.';
    }
    if (password !== confirmPassword) {
      clientErrors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    }
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(regForm, clientErrors);
      return;
    }

    const btn = document.getElementById('register-submit');
    btn.disabled = true;
    try {
      const data = await api.post('/api/auth/register', { fullName, email, phone, password });
      await mergeGuestCartAfterLogin();
      showToast('Đăng ký tài khoản thành công!');
      window.location.href = getSafeRedirect(data.user);
    } catch (err) {
      setFieldErrors(regForm, err.errors);
      regErr.textContent = err.message;
      regErr.classList.remove('hidden');
      btn.disabled = false;
    }
  });
})();
