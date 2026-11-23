import { api } from './api.js';

const STORAGE_KEY = 'nha_rang_guest_cart';

// Doc danh sach [{ variantId, quantity }] tu localStorage
export function getGuestCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveGuestCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function clearGuestCart() {
  localStorage.removeItem(STORAGE_KEY);
}

// Cap nhat con so tren icon gio hang o header
export function updateCartBadge(count) {
  const badge = document.getElementById('header-cart-badge');
  if (!badge) return;
  const n = Number(count || 0);
  badge.textContent = n > 99 ? '99+' : String(n);
  badge.classList.toggle('hidden', n <= 0);
}

export function countItems(items) {
  return (items || []).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
}

// Lay du lieu gio hang day du (da dang nhap -> DB; chua dang nhap -> preview tu server)
export async function loadCartSummary(user) {
  if (user && user.role === 'customer') {
    const summary = await api.get('/api/cart');
    updateCartBadge(countItems(summary.items));
    return summary;
  }
  const guestItems = getGuestCart();
  const summary = await api.post('/api/cart/preview', { items: guestItems });
  updateCartBadge(countItems(guestItems));
  return summary;
}

// Them mon vao gio (dung cho ca khach vang lai va Customer)
export async function addToCart(user, variantId, quantity = 1) {
  const vid = Number(variantId);
  const qty = Math.max(1, Math.min(20, Number(quantity || 1)));

  if (user && user.role === 'customer') {
    const summary = await api.post('/api/cart/items', { variantId: vid, quantity: qty });
    updateCartBadge(countItems(summary.items));
    return summary;
  }

  // Khach vang lai: luu vao localStorage
  const list = getGuestCart();
  const idx = list.findIndex((x) => Number(x.variantId) === vid);
  if (idx >= 0) {
    list[idx].quantity = Math.min(20, Number(list[idx].quantity) + qty);
  } else {
    list.push({ variantId: vid, quantity: qty });
  }
  saveGuestCart(list);
  updateCartBadge(countItems(list));
  return list;
}

// Gop gio hang localStorage vao DB ngay sau khi khach dang nhap
export async function mergeGuestCartAfterLogin() {
  const guestItems = getGuestCart();
  if (guestItems.length === 0) return;
  try {
    const summary = await api.post('/api/cart/merge', { items: guestItems });
    clearGuestCart();
    updateCartBadge(countItems(summary.items));
  } catch (err) {
    console.warn('Khong gop duoc gio hang:', err.message);
  }
}
