const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VN_PHONE_RE = /^(0|\+84)[0-9]{9}$/;

function trimStr(val) {
  return typeof val === 'string' ? val.trim() : '';
}

function isValidEmail(email) {
  return EMAIL_RE.test(trimStr(email).toLowerCase());
}

function isValidPhone(phone) {
  const cleaned = trimStr(phone).replace(/[\s.-]/g, '');
  return VN_PHONE_RE.test(cleaned);
}

function normalizePhone(phone) {
  return trimStr(phone).replace(/[\s.-]/g, '');
}

// Mat khau toi thieu 8 ky tu, co it nhat 1 chu cai va 1 chu so
function isStrongPassword(password) {
  if (typeof password !== 'string' || password.length < 8) return false;
  return /[A-Za-z]/.test(password) && /[0-9]/.test(password);
}

function isNonNegativeInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n >= 0;
}

function isPositiveInt(val) {
  const n = Number(val);
  return Number.isInteger(n) && n > 0;
}

function isInEnum(val, list) {
  return list.includes(val);
}

// Chuyen ten tieng Viet thanh slug URL hop le
function slugify(text) {
  return trimStr(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Rut gon ten khach hien thi cong khai (vi du "Nguyen Thi Lan Anh" -> "Lan A.")
function shortenCustomerName(fullName) {
  const parts = trimStr(fullName).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] || 'Khách hàng';
  const last = parts[parts.length - 1];
  const prev = parts[parts.length - 2];
  return `${prev} ${last.charAt(0).toUpperCase()}.`;
}

module.exports = {
  trimStr,
  isValidEmail,
  isValidPhone,
  normalizePhone,
  isStrongPassword,
  isNonNegativeInt,
  isPositiveInt,
  isInEnum,
  slugify,
  shortenCustomerName,
};
