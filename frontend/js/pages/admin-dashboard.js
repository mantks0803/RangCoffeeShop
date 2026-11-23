import { api } from '../api.js';
import { initAdminLayout } from '../layout.js';
import {
  escapeHTML, formatVND, formatDate, renderStatusPill,
  STATUS_LABELS, renderErrorState,
} from '../ui.js';

let activeRange = 30;


const number = new Intl.NumberFormat('vi-VN');
const compactNumber = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const statusKeys = ['completed', 'shipping', 'confirmed', 'pending', 'cancelled'];

// Cùng thang ngày cho cột doanh thu và đường số đơn hoàn tất.
function renderTrendChart(days, metric) {
  const isRevenue = metric === 'revenue';
  const width = 540;
  const height = 212;
  const left = isRevenue ? 72 : 44;
  const right = width - 26;
  const top = 12;
  const bottom = height - 32;
  const step = (right - left) / Math.max(1, days.length);
  const unit = isRevenue ? 100000 : 1;
  const peak = Math.max(0, ...days.map((day) => Number(day[metric])));
  const tick = Math.max(1, Math.ceil(peak / (unit * 4))) * unit;
  const points = days.map((day, i) => ({
    x: left + step * (i + 0.5),
    y: bottom - Number(day[metric]) * (bottom - top) / (tick * 4),
    label: day.date.slice(8, 10) + '/' + day.date.slice(5, 7),
    value: Number(day[metric]),
  }));
  const plot = points.map(({ x, y }) => x.toFixed(2) + ',' + y.toFixed(2)).join(' ');
  const barWidth = Math.max(2, step * 0.66);
  const labelStep = days.length <= 7 ? 1 : Math.ceil((days.length - 1) / 4);
  const chartLabel = isRevenue ? 'Doanh thu từ đơn hoàn tất' : 'Số đơn hoàn tất';
  const hint = isRevenue ? 'Chọn một cột để xem doanh thu.' : 'Chọn một điểm để xem số đơn.';

  return `
    <figure class="dashboard-chart dashboard-trend ${isRevenue ? 'trend-revenue' : 'trend-orders'}">
      <svg viewBox="0 0 ${width} ${height}" role="group" aria-label="${chartLabel} theo ngày">
        ${Array.from({ length: 5 }, (_, i) => {
          const y = bottom - (bottom - top) * i / 4;
          return `
            <line class="chart-gridline" x1="${left}" x2="${right}" y1="${y}" y2="${y}" />
            <text class="chart-tick" x="${left - 8}" y="${y + 4}" text-anchor="end">${compactNumber.format(i * tick)}</text>
          `;
        }).join('')}
        ${!isRevenue && points.length ? `
          <polygon class="chart-area" points="${points[0].x},${bottom} ${plot} ${points.at(-1).x},${bottom}" />
          <polyline class="chart-line" points="${plot}" />
        ` : ''}
        ${points.map(({ x, y, label, value }, i) => {
          const detail = label + ' · ' + (isRevenue ? formatVND(value) : number.format(value) + ' đơn hoàn tất');
          const shape = isRevenue
            ? `<rect class="chart-bar${value ? '' : ' chart-bar-empty'}" x="${x - barWidth / 2}" y="${Math.min(y, bottom - 1)}" width="${barWidth}" height="${Math.max(1, bottom - y)}" rx="2" />`
            : `<circle class="chart-point" cx="${x}" cy="${y}" r="${days.length > 30 ? 2 : 3.4}" />`;
          const showLabel = i === days.length - 1 || (i % labelStep === 0 && i < days.length - labelStep / 2);
          return `
            <g class="chart-datum" tabindex="0" role="img" aria-label="${escapeHTML(detail)}" data-tip="${escapeHTML(detail)}">
              <title>${escapeHTML(detail)}</title>
              <rect class="chart-hit-area" x="${x - step / 2}" y="${top}" width="${step}" height="${bottom - top}" />
              ${shape}
            </g>
            ${showLabel ? `<text class="chart-tick chart-date" x="${x}" y="${height - 9}" text-anchor="middle">${escapeHTML(label)}</text>` : ''}
          `;
        }).join('')}
      </svg>
      <figcaption class="chart-caption" aria-live="polite">${hint}</figcaption>
    </figure>
  `;
}

function renderStatusChart(breakdown) {
  const counts = statusKeys.map((key) => Number(breakdown[key] || 0));
  const total = counts.reduce((sum, count) => sum + count, 0);
  let offset = 0;
  const rings = statusKeys.map((key, i) => {
    if (!total || !counts[i]) return '';
    const length = counts[i] * 100 / total;
    const segment = `<circle class="status-${key}" cx="60" cy="60" r="47" pathLength="100"
      stroke-dasharray="${length} ${100 - length}" stroke-dashoffset="${-offset}" />`;
    offset += length;
    return segment;
  }).join('');

  return `
    <div class="dashboard-status-chart">
      <div class="chart-donut" aria-label="${number.format(total)} đơn hàng" role="img">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="chart-ring-track" cx="60" cy="60" r="47" />
          <g transform="rotate(-90 60 60)">${rings}</g>
        </svg>
        <div class="chart-donut-label" aria-hidden="true"><strong>${number.format(total)}</strong><span>đơn hàng</span></div>
      </div>
      <ul class="chart-legend">
        ${statusKeys.map((key, i) => `
          <li>
            <span class="chart-swatch status-${key}" aria-hidden="true"></span>
            <span>${STATUS_LABELS[key]}</span>
            <strong class="tabular">${number.format(counts[i])}</strong>
          </li>
        `).join('')}
      </ul>
    </div>
  `;
}

function renderStockChart({ outOfStock, lowStock, inStock }) {
  const groups = [
    { label: 'Hết hàng', count: outOfStock, style: 'stock-out' },
    { label: 'Sắp hết · 1–5', count: lowStock, style: 'stock-low' },
    { label: 'Đủ hàng · trên 5', count: inStock, style: 'stock-available' },
  ];
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return `
    <ul class="chart-bar-list">
      ${groups.map(({ label, count, style }) => `
        <li>
          <div class="chart-bar-label"><span>${label}</span><strong class="tabular">${number.format(count)}</strong></div>
          <div class="chart-bar-track" aria-hidden="true">
            <div class="chart-bar-fill ${style}" style="width:${total ? count * 100 / total : 0}%"></div>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}



function showCurrentReport() {
  const panels = document.querySelectorAll('[data-report]');
  const hash = location.hash.slice(1);
  const current = [...panels].some(panel => panel.dataset.report === hash) ? hash : 'ban-hang';
  for (const panel of panels) panel.hidden = panel.dataset.report !== current;
  for (const link of document.querySelectorAll('.report-switch a')) {
    if (link.hash === '#' + current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

window.addEventListener('hashchange', showCurrentReport);

async function loadDashboard() {
  const root = document.getElementById('dashboard-root');
  root.innerHTML = '<div class="skeleton" style="height:120px;"></div><div class="skeleton" style="height:280px;margin-top:16px;"></div>';

  try {
    const data = await api.get(`/api/admin/stats?range=${activeRange}`, { redirectOn401: true });
    const { kpi, dailyRevenue, topProducts, statusBreakdown, stockBreakdown, lowStock, recentOrders } = data;
    const growthSign = kpi.revenueGrowth > 0 ? '+' : '';
    const growthColor = kpi.revenueGrowth >= 0 ? 'var(--sage)' : 'var(--danger)';
    const maxSold = Math.max(1, ...topProducts.map((p) => Number(p.totalSold || 0)));

    root.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="mono-label">DOANH THU 30 NGÀY (HOÀN TẤT)</div>
          <div class="kpi-value">${formatVND(kpi.revenue30d)}</div>
          <div style="font-size:0.82rem;color:${growthColor};">${growthSign}${kpi.revenueGrowth}% so với 30 ngày trước</div>
        </div>
        <div class="kpi-card">
          <div class="mono-label">SỐ ĐƠN 30 NGÀY</div>
          <div class="kpi-value">${kpi.orders30d}</div>
          <div class="text-soft" style="font-size:0.82rem;">Tính mọi trạng thái</div>
        </div>
        <a class="kpi-card" href="/admin/orders.html?status=pending" style="display:block;border-color:var(--amber);">
          <div class="mono-label">ĐƠN CHỜ XỬ LÝ</div>
          <div class="kpi-value" style="color:var(--amber);">${kpi.pendingOrders}</div>
          <div style="font-size:0.82rem;text-decoration:underline;">Xem danh sách cần xử lý →</div>
        </a>
        <div class="kpi-card">
          <div class="mono-label">GIÁ TRỊ ĐƠN TRUNG BÌNH</div>
          <div class="kpi-value">${formatVND(kpi.avgOrderValue)}</div>
          <div class="text-soft" style="font-size:0.82rem;">Trên các đơn hoàn tất</div>
        </div>
      </div>

      <nav class="report-switch" aria-label="Chọn báo cáo">
        <a href="#ban-hang">Bán hàng</a>
        <a href="#don-hang">Đơn hàng</a>
        <a href="#kho">Kho &amp; sản phẩm</a>
      </nav>
      <div data-report="ban-hang" hidden>
        <section class="dashboard-block" aria-labelledby="performance-title">
          <div class="dashboard-block-head">
            <div>
              <h2 id="performance-title">Hiệu quả bán hàng</h2>
              <p class="text-soft">Tính theo ngày đặt của các đơn đã hoàn tất.</p>
            </div>
            <div class="chip-row" role="group" aria-label="Khoảng thời gian của biểu đồ">
              ${[7, 30, 90].map((r) => `
                <button type="button" class="filter-chip ${activeRange === r ? 'active' : ''}" aria-pressed="${activeRange === r}" data-range="${r}">${r} ngày</button>
              `).join('')}
            </div>
          </div>
          <div class="dashboard-grid dashboard-trends">
            <section class="panel">
              <h3 class="dashboard-panel-title">Doanh thu theo ngày <span>₫</span></h3>
              ${renderTrendChart(dailyRevenue, 'revenue')}
            </section>
            <section class="panel">
              <h3 class="dashboard-panel-title">Đơn hoàn tất theo ngày</h3>
              ${renderTrendChart(dailyRevenue, 'orderCount')}
            </section>
          </div>
        </section>

      </div>
      <div class="dashboard-grid" data-report="don-hang" hidden>
        <section class="panel">
          <h2 class="dashboard-panel-title">Đơn hàng theo trạng thái</h2>
          <p class="dashboard-panel-note text-soft">Tất cả đơn</p>
          ${renderStatusChart(statusBreakdown)}
        </section>
        <section class="panel">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="font-size:1.1rem;margin:0;">8 đơn hàng mới nhất</h2>
            <a href="/admin/orders.html" style="font-size:0.84rem;color:var(--accent);text-decoration:underline;">Xem tất cả →</a>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Mã đơn</th><th>Khách</th><th>Trạng thái</th><th style="text-align:right;">Tổng</th></tr></thead>
              <tbody>
                ${recentOrders.map((o) => `
                  <tr class="clickable" data-goto-order="${escapeHTML(o.order_code)}">
                    <td class="mono-label" style="color:var(--ink);font-weight:600;">${escapeHTML(o.order_code)}</td>
                    <td>${escapeHTML(o.customerName)}<div class="text-soft" style="font-size:0.78rem;">${formatDate(o.created_at)}</div></td>
                    <td>${renderStatusPill(o.status)}</td>
                    <td class="tabular" style="text-align:right;font-weight:600;">${formatVND(o.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <div data-report="kho" hidden>
        <div class="dashboard-grid">
          <section class="panel">
            <h2 class="dashboard-panel-title">Tình trạng tồn kho</h2>
            <p class="dashboard-panel-note text-soft">Các biến thể đang bán</p>
            ${renderStockChart(stockBreakdown)}
          </section>
          <section class="panel">
            <h2 class="dashboard-panel-title">Top sản phẩm bán chạy</h2>
            <p class="dashboard-panel-note text-soft">Số lượng bán từ tất cả đơn hoàn tất</p>
            ${topProducts.length ? `
              <ol class="chart-bar-list">
                ${topProducts.map((p) => `
                  <li>
                    <div class="chart-bar-label"><span>${escapeHTML(p.name)}</span><strong class="tabular">${number.format(Number(p.totalSold))} sp</strong></div>
                    <div class="chart-bar-track" aria-hidden="true">
                      <div class="chart-bar-fill rank-fill" style="width:${Number(p.totalSold) * 100 / maxSold}%"></div>
                    </div>
                  </li>
                `).join('')}
              </ol>
            ` : '<p class="text-soft">Chưa có dữ liệu bán hàng.</p>'}
          </section>
        </div>
        <div class="panel dashboard-block">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <h2 style="font-size:1.1rem;margin:0;">Sắp hết hàng (tồn kho ≤ 5)</h2>
            <a href="/admin/products.html" style="font-size:0.84rem;color:var(--accent);text-decoration:underline;">Quản lý kho →</a>
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Sản phẩm / Biến thể</th><th>SKU</th><th style="text-align:right;">Tồn</th></tr></thead>
              <tbody>
                ${lowStock.map((v) => `
                  <tr>
                    <td>
                      <strong>${escapeHTML(v.productName)}</strong>
                      <div class="text-soft" style="font-size:0.8rem;">${escapeHTML(v.label)}</div>
                    </td>
                    <td class="mono-label">${escapeHTML(v.sku)}</td>
                    <td class="tabular" style="text-align:right;font-weight:700;color:${v.stock === 0 ? 'var(--danger)' : 'var(--amber)'};">${v.stock}</td>
                  </tr>
                `).join('') || '<tr><td colspan="3" class="text-soft">Tất cả biến thể đều đủ hàng.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    showCurrentReport();
    root.querySelectorAll('.chart-datum').forEach((datum) => {
      const caption = datum.closest('figure').querySelector('figcaption');
      const show = () => { caption.textContent = datum.dataset.tip; };
      datum.addEventListener('pointerenter', show);
      datum.addEventListener('focus', show);
      datum.addEventListener('click', show);
    });

    root.querySelectorAll('[data-range]').forEach((button) => {
      button.addEventListener('click', async () => {
        const range = Number(button.dataset.range);
        if (range === activeRange) return;
        activeRange = range;
        await loadDashboard();
        root.querySelector('[data-range="' + range + '"]')?.focus({ preventScroll: true });
      });
    });


    root.querySelectorAll('[data-goto-order]').forEach((tr) => {
      tr.addEventListener('click', () => {
        window.location.href = `/admin/orders.html?code=${encodeURIComponent(tr.dataset.gotoOrder)}`;
      });
    });
  } catch (err) {
    root.innerHTML = renderErrorState(err.message, 'retry-dash');
    document.getElementById('retry-dash')?.addEventListener('click', loadDashboard);
  }
}

(async () => {
  const user = await initAdminLayout('dashboard');
  if (!user) return;
  document.getElementById('admin-page-heading').textContent = 'Tổng quan';
  await loadDashboard();
})();
