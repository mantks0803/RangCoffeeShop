import { api } from '../api.js';
import { initAdminLayout } from '../layout.js';
import {
  escapeHTML, formatVND, renderPagination, focusResults, renderErrorState,
  showToast, confirmDialog, setFieldErrors,
} from '../ui.js';

let currentUser = null;
let canWriteProducts = false;
let canWriteCategories = false;
let categories = [];
let filterState = { q: '', categoryId: '', status: '', page: 1 };

function slugifyClient(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function loadCategories() {
  categories = await api.get('/api/admin/categories');
}

async function loadProducts() {
  const root = document.getElementById('admin-products-root');
  const qs = new URLSearchParams({ page: String(filterState.page), pageSize: '8' });
  if (filterState.q) qs.set('q', filterState.q);
  if (filterState.categoryId) qs.set('categoryId', filterState.categoryId);
  if (filterState.status) qs.set('status', filterState.status);

  try {
    const data = await api.get(`/api/admin/products?${qs.toString()}`, { redirectOn401: true });
    root.innerHTML = `
      ${!canWriteProducts ? '<div class="panel" style="padding:12px 16px;background:#FFF8F2;border-color:var(--amber);margin-bottom:16px;">Tài khoản cấp <strong>Staff</strong> đang xem ở chế độ chỉ đọc. Liên hệ Manager/Owner để thêm hoặc chỉnh sửa sản phẩm.</div>' : ''}

      <div class="panel" style="padding:14px;margin-bottom:16px;">
        <form id="prod-filter-form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;">
          <input name="q" class="form-control" style="max-width:260px;min-height:38px;" placeholder="Tìm tên hoặc slug..." value="${escapeHTML(filterState.q)}">
          <select name="categoryId" class="form-control" style="max-width:200px;min-height:38px;">
            <option value="">Tất cả danh mục</option>
            ${categories.map((c) => `<option value="${c.id}" ${String(filterState.categoryId) === String(c.id) ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
          </select>
          <select name="status" class="form-control" style="max-width:160px;min-height:38px;">
            <option value="">Mọi trạng thái</option>
            <option value="active" ${filterState.status === 'active' ? 'selected' : ''}>Đang bán</option>
            <option value="inactive" ${filterState.status === 'inactive' ? 'selected' : ''}>Đang ẩn</option>
          </select>
          <button type="submit" class="btn btn-secondary btn-sm">Lọc</button>
        </form>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Sản phẩm</th>
              <th>Danh mục</th>
              <th>Giá thấp nhất</th>
              <th>Tồn kho theo biến thể</th>
              <th>Đang bán</th>
              ${canWriteProducts ? '<th>Thao tác</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${data.items.map((p) => `
              <tr>
                <td>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${escapeHTML(p.primary_image || '/assets/placeholder.svg')}" alt="${escapeHTML(p.name)}"
                         width="44" height="54" style="object-fit:cover;border-radius:4px;border:1px solid var(--line);"
                         onerror="this.onerror=null;this.src='/assets/placeholder.svg';">
                    <div>
                      <strong>${escapeHTML(p.name)}</strong>
                      ${p.is_featured ? '<span class="pill pill-pending" style="margin-left:6px;font-size:0.7rem;">Nổi bật</span>' : ''}
                      <div class="mono-label" style="font-size:0.7rem;">${escapeHTML(p.slug)}</div>
                    </div>
                  </div>
                </td>
                <td>${escapeHTML(p.category_name)}</td>
                <td class="tabular">${formatVND(p.min_price)}</td>
                <td>
                  <div style="display:grid;gap:6px;">
                    ${p.variants.map((v) => `
                      <div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;">
                        <span class="text-soft" style="min-width:110px;">${escapeHTML(v.label)}</span>
                        ${canWriteProducts
                          ? `<input type="number" min="0" value="${v.stock}" data-quick-stock="${v.id}"
                                    style="width:72px;padding:4px 6px;border:1px solid var(--line);border-radius:4px;text-align:right;" class="tabular">
                             <span class="text-sage hidden" data-saved="${v.id}" style="font-size:0.75rem;">Đã lưu</span>`
                          : `<strong class="tabular">${v.stock}</strong>`}
                      </div>
                    `).join('')}
                  </div>
                </td>
                <td>
                  <input type="checkbox" ${p.is_active ? 'checked' : ''} ${canWriteProducts ? `data-toggle-active="${p.id}"` : 'disabled'} aria-label="Bật tắt bán ${escapeHTML(p.name)}">
                </td>
                ${canWriteProducts ? `
                  <td>
                    <div style="display:flex;gap:6px;">
                      <button type="button" class="btn btn-secondary btn-sm" data-edit-prod="${p.id}">Sửa</button>
                      <button type="button" class="btn btn-ghost btn-sm text-danger" data-del-prod="${p.id}" data-del-name="${escapeHTML(p.name)}">Xóa</button>
                    </div>
                  </td>
                ` : ''}
              </tr>
            `).join('') || '<tr><td colspan="6" class="text-soft">Không có sản phẩm nào.</td></tr>'}
          </tbody>
        </table>
      </div>
      ${renderPagination(data.page, data.totalPages)}
    `;

    document.getElementById('prod-filter-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      filterState = { q: f.q.value.trim(), categoryId: f.categoryId.value, status: f.status.value, page: 1 };
      loadProducts();
    });

    root.querySelectorAll('[data-page]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (b.disabled) return;
        filterState.page = Number(b.dataset.page);
        await loadProducts();
        focusResults(root);
      });
    });

    // Sua ton kho nhanh ngay tren bang
    root.querySelectorAll('[data-quick-stock]').forEach((inp) => {
      const saveStock = async () => {
        const vid = inp.dataset.quickStock;
        const val = parseInt(inp.value, 10);
        if (Number.isNaN(val) || val < 0) return;
        try {
          await api.patch(`/api/admin/variants/${vid}/stock`, { stock: val });
          const badge = root.querySelector(`[data-saved="${vid}"]`);
          if (badge) {
            badge.classList.remove('hidden');
            setTimeout(() => badge.classList.add('hidden'), 1500);
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      };
      inp.addEventListener('change', saveStock);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
    });

    // Bat tat dang ban
    root.querySelectorAll('[data-toggle-active]').forEach((cb) => {
      cb.addEventListener('change', async () => {
        try {
          await api.patch(`/api/admin/products/${cb.dataset.toggleActive}/active`, { isActive: cb.checked });
          showToast(cb.checked ? 'Đã bật hiển thị sản phẩm.' : 'Đã ẩn sản phẩm.');
        } catch (err) {
          cb.checked = !cb.checked;
          showToast(err.message, 'error');
        }
      });
    });

    // Sua san pham
    root.querySelectorAll('[data-edit-prod]').forEach((b) => {
      b.addEventListener('click', () => openProductDrawer(Number(b.dataset.editProd)));
    });

    // Xoa san pham
    root.querySelectorAll('[data-del-prod]').forEach((b) => {
      b.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Xóa sản phẩm',
          message: `Bạn có chắc muốn xóa "${b.dataset.delName}"? Nếu sản phẩm đã có trong đơn hàng, hệ thống sẽ chuyển sang ẩn thay vì xóa hẳn.`,
          confirmText: 'Tiếp tục',
        });
        if (!ok) return;
        try {
          const res = await api.del(`/api/admin/products/${b.dataset.delProd}`);
          showToast(res.message || 'Đã xử lý.');
          loadProducts();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    root.innerHTML = renderErrorState(err.message, 'retry-aprod');
    document.getElementById('retry-aprod')?.addEventListener('click', loadProducts);
  }
}

async function openProductDrawer(productId = null) {
  let prod = null;
  if (productId) {
    try {
      prod = await api.get(`/api/admin/products/${productId}`);
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  const variants = prod?.variants?.length ? prod.variants : [{ sku: '', label: '250g · Nguyên hạt', price: 150000, compare_at_price: '', stock: 20 }];
  const images = prod?.images?.length ? prod.images : [{ url: 'https://picsum.photos/seed/nha-rang-moi/800/800', alt_text: '', is_primary: 1 }];

  const host = document.getElementById('admin-drawer-host');
  host.innerHTML = `
    <div class="drawer-backdrop" id="prod-drawer-bd">
      <div class="drawer-panel" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${prod ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
          <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
        </div>

        <form id="prod-drawer-form" novalidate>
          <div class="form-group">
            <label class="form-label">Tên sản phẩm</label>
            <input name="name" class="form-control" value="${escapeHTML(prod?.name || '')}" required>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Slug (URL)</label>
              <input name="slug" class="form-control" value="${escapeHTML(prod?.slug || '')}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Danh mục</label>
              <select name="categoryId" class="form-control">
                ${categories.map((c) => `<option value="${c.id}" ${Number(prod?.category_id) === Number(c.id) ? 'selected' : ''}>${escapeHTML(c.name)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả ngắn (dưới 120 ký tự)</label>
            <input name="shortDescription" class="form-control" value="${escapeHTML(prod?.short_description || '')}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mô tả chi tiết</label>
            <textarea name="description" class="form-control" rows="4" required>${escapeHTML(prod?.description || '')}</textarea>
          </div>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Vùng trồng (cho cà phê)</label>
              <input name="origin" class="form-control" value="${escapeHTML(prod?.origin || '')}" placeholder="Cầu Đất, Đà Lạt · 1.550m">
            </div>
            <div class="form-group">
              <label class="form-label">Mức rang</label>
              <select name="roastLevel" class="form-control">
                <option value="">Không áp dụng</option>
                <option value="light" ${prod?.roast_level === 'light' ? 'selected' : ''}>Rang nhạt</option>
                <option value="medium" ${prod?.roast_level === 'medium' ? 'selected' : ''}>Rang vừa</option>
                <option value="dark" ${prod?.roast_level === 'dark' ? 'selected' : ''}>Rang đậm</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:18px;margin-bottom:16px;">
            <label class="filter-option"><input type="checkbox" name="isActive" ${prod ? (prod.is_active ? 'checked' : '') : 'checked'}> Đang bán</label>
            <label class="filter-option"><input type="checkbox" name="isFeatured" ${prod?.is_featured ? 'checked' : ''}> Sản phẩm nổi bật</label>
          </div>

          <div style="border-top:1px solid var(--line);padding-top:14px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong>Biến thể sản phẩm</strong>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-variant">+ Thêm biến thể</button>
            </div>
            <div id="variants-list" style="display:grid;gap:10px;"></div>
          </div>

          <div style="border-top:1px solid var(--line);padding-top:14px;margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong>Hình ảnh (URL)</strong>
              <button type="button" class="btn btn-secondary btn-sm" id="btn-add-image">+ Thêm ảnh</button>
            </div>
            <div id="images-list" style="display:grid;gap:8px;"></div>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" data-close>Hủy</button>
            <button type="submit" class="btn btn-primary">Lưu sản phẩm</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const close = () => { document.removeEventListener('keydown', onEsc); host.innerHTML = ''; };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onEsc);
  host.querySelector('#prod-drawer-bd').addEventListener('click', (e) => {
    if (e.target.id === 'prod-drawer-bd' || e.target.closest('[data-close]')) close();
  });

  const form = document.getElementById('prod-drawer-form');
  // Tu sinh slug khi go ten (neu tao moi)
  if (!prod) {
    form.name.addEventListener('input', () => {
      form.slug.value = slugifyClient(form.name.value);
    });
  }

  const vList = document.getElementById('variants-list');
  const addVariantRow = (v = {}) => {
    const row = document.createElement('div');
    row.className = 'variant-row-item';
    row.style.cssText = 'padding:10px;border:1px solid var(--line);border-radius:6px;display:grid;gap:8px;';
    row.innerHTML = `
      <input type="hidden" data-v="id" value="${v.id || ''}">
      <div class="form-grid-2">
        <input class="form-control" data-v="sku" placeholder="SKU (vd: NR-0199-01)" value="${escapeHTML(v.sku || '')}" required>
        <input class="form-control" data-v="label" placeholder="Nhãn (vd: 250g · Nguyên hạt)" value="${escapeHTML(v.label || '')}" required>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 90px auto;gap:8px;align-items:center;">
        <input type="number" min="0" class="form-control" data-v="price" placeholder="Giá bán" value="${v.price ?? ''}" required>
        <input type="number" min="0" class="form-control" data-v="compareAtPrice" placeholder="Giá gốc" value="${v.compare_at_price ?? ''}">
        <input type="number" min="0" class="form-control" data-v="stock" placeholder="Tồn" value="${v.stock ?? 0}" required>
        <button type="button" class="btn btn-ghost btn-sm text-danger" data-rm-row>✕</button>
      </div>
    `;
    row.querySelector('[data-rm-row]').addEventListener('click', () => {
      if (vList.children.length > 1) row.remove();
    });
    vList.appendChild(row);
  };
  variants.forEach(addVariantRow);
  document.getElementById('btn-add-variant').addEventListener('click', () => addVariantRow({ stock: 10 }));

  const imgList = document.getElementById('images-list');
  const addImageRow = (im = {}, idx = 0) => {
    const row = document.createElement('div');
    row.className = 'image-row-item';
    row.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;';
    row.innerHTML = `
      <input type="radio" name="primaryImageIdx" ${im.is_primary ? 'checked' : ''} title="Ảnh chính">
      <input class="form-control" data-im="url" placeholder="https://..." value="${escapeHTML(im.url || '')}" required>
      <button type="button" class="btn btn-ghost btn-sm text-danger" data-rm-img>✕</button>
    `;
    row.querySelector('[data-rm-img]').addEventListener('click', () => {
      if (imgList.children.length > 1) row.remove();
    });
    imgList.appendChild(row);
  };
  images.forEach(addImageRow);
  document.getElementById('btn-add-image').addEventListener('click', () => addImageRow({}));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setFieldErrors(form, {});
    const vData = Array.from(vList.querySelectorAll('.variant-row-item')).map((row) => ({
      id: row.querySelector('[data-v="id"]').value || null,
      sku: row.querySelector('[data-v="sku"]').value.trim(),
      label: row.querySelector('[data-v="label"]').value.trim(),
      price: Number(row.querySelector('[data-v="price"]').value),
      compareAtPrice: row.querySelector('[data-v="compareAtPrice"]').value !== '' ? Number(row.querySelector('[data-v="compareAtPrice"]').value) : null,
      stock: Number(row.querySelector('[data-v="stock"]').value),
    }));
    const imData = Array.from(imgList.querySelectorAll('.image-row-item')).map((row) => ({
      url: row.querySelector('[data-im="url"]').value.trim(),
      isPrimary: row.querySelector('input[type="radio"]').checked,
    }));

    const payload = {
      name: form.name.value.trim(),
      slug: form.slug.value.trim(),
      categoryId: Number(form.categoryId.value),
      shortDescription: form.shortDescription.value.trim(),
      description: form.description.value.trim(),
      origin: form.origin.value.trim() || null,
      roastLevel: form.roastLevel.value || null,
      isActive: form.isActive.checked,
      isFeatured: form.isFeatured.checked,
      variants: vData,
      images: imData,
    };

    try {
      if (prod) await api.put(`/api/admin/products/${prod.id}`, payload);
      else await api.post('/api/admin/products', payload);
      showToast(prod ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm mới.');
      close();
      loadProducts();
    } catch (err) {
      setFieldErrors(form, err.errors);
      showToast(err.message, 'error');
    }
  });
}

function openCategoriesModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" style="max-width:600px;">
      <div class="modal-head">
        <h3>Quản lý danh mục</h3>
        <button type="button" class="icon-btn" data-close aria-label="Đóng">✕</button>
      </div>
      <div class="table-wrap" style="margin-bottom:16px;">
        <table class="data-table">
          <thead><tr><th>Tên danh mục</th><th>Slug</th><th>Thứ tự</th><th>SP</th></tr></thead>
          <tbody>
            ${categories.map((c) => `
              <tr>
                <td><strong>${escapeHTML(c.name)}</strong></td>
                <td class="mono-label">${escapeHTML(c.slug)}</td>
                <td class="tabular">${c.sort_order}</td>
                <td class="tabular">${c.product_count}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${canWriteCategories ? `
        <form id="cat-add-form" style="border-top:1px solid var(--line);padding-top:14px;">
          <strong style="display:block;margin-bottom:10px;">Thêm danh mục mới</strong>
          <div class="form-grid-2">
            <div class="form-group">
              <label class="form-label">Tên danh mục</label>
              <input name="name" class="form-control" required>
            </div>
            <div class="form-group">
              <label class="form-label">Thứ tự hiển thị</label>
              <input name="sortOrder" type="number" min="0" value="${categories.length + 1}" class="form-control">
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-sm">Thêm danh mục</button>
        </form>
      ` : ''}
    </div>
  `;

  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || e.target.closest('[data-close]')) close();
  });

  backdrop.querySelector('#cat-add-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api.post('/api/admin/categories', {
        name: f.name.value.trim(),
        sortOrder: Number(f.sortOrder.value || 0),
      });
      showToast('Đã thêm danh mục mới.');
      await loadCategories();
      close();
      openCategoriesModal();
      loadProducts();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.body.appendChild(backdrop);
}

(async () => {
  currentUser = await initAdminLayout('products');
  if (!currentUser) return;
  document.getElementById('admin-page-heading').textContent = 'Sản phẩm & Danh mục';
  canWriteProducts = currentUser.permissions.includes('products:write');
  canWriteCategories = currentUser.permissions.includes('categories:write');

  const actions = document.getElementById('admin-products-actions');
  actions.innerHTML = `
    <button type="button" class="btn btn-secondary btn-sm" id="btn-manage-cats">Danh mục</button>
    ${canWriteProducts ? '<button type="button" class="btn btn-primary btn-sm" id="btn-new-product">+ Thêm sản phẩm</button>' : ''}
  `;
  document.getElementById('btn-manage-cats').addEventListener('click', openCategoriesModal);
  document.getElementById('btn-new-product')?.addEventListener('click', () => openProductDrawer(null));

  await loadCategories();
  await loadProducts();
})();
