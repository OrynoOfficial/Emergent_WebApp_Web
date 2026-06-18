// Coerce any axios / fetch error into a human-readable string so toasts and
// React children never accidentally render raw objects.
//
// FastAPI 422 responses look like:
//   { detail: [{ type, loc, msg, input }, ...] }
// Rendering that array directly crashes React with error #31. This helper
// flattens it into "field: message; field: message".
export function extractErrorMessage(err, fallback = 'Something went wrong') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map(d => {
        if (typeof d === 'string') return d;
        const field = Array.isArray(d?.loc) ? d.loc.slice(1).join('.') : d?.loc;
        return field ? `${field}: ${d?.msg || 'invalid'}` : (d?.msg || 'invalid');
      })
      .join('; ');
  }
  if (detail && typeof detail === 'object') return detail.msg || JSON.stringify(detail);
  return err?.message || fallback;
}
