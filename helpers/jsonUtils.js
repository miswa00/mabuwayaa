// helpers/jsonUtils.js

// ✅ Flatten a nested object into dot-notation keys (used when saving to flat JSON or MongoDB)
export function flatten(obj, prefix = "", res = {}) {
  for (const key in obj) {
    const value = obj[key];
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === "object" && v !== null) {
          flatten(v, `${newKey}.${i}`, res);
        } else {
          res[`${newKey}.${i}`] = v;
        }
      });
    } else if (value && typeof value === "object") {
      flatten(value, newKey, res);
    } else {
      res[newKey] = value;
    }
  }
  return res;
}

// ✅ Unflatten dot-notation keys into nested objects/arrays (used when reading JSON or MongoDB)
export function unflatten(data) {
  const result = {};

  for (const flatKey in data) {
    const parts = flatKey.split(".");
    let cur = result;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const next = parts[i + 1];
      const isNextIndex = /^\d+$/.test(next);

      if (isLast) {
        // Last key: set the actual value
        if (/^\d+$/.test(part)) {
          const idx = parseInt(part, 10);
          if (!Array.isArray(cur)) {
            // Convert current object to array if needed
            const parentKey = parts[i - 1];
            if (parentKey && !Array.isArray(cur[parentKey])) cur[parentKey] = [];
            cur = cur[parentKey];
          }
          cur[idx] = parseValue(data[flatKey]);
        } else {
          cur[part] = parseValue(data[flatKey]);
        }
      } else {
        // Intermediate key: create an object or array as needed
        if (!cur[part]) {
          cur[part] = isNextIndex ? [] : {};
        }
        cur = cur[part];
      }
    }
  }

  return result;
}

// ✅ Helper: safely parse common value types
function parseValue(v) {
  if (typeof v !== "string") return v;

  // Handle booleans
  if (v === "true") return true;
  if (v === "false") return false;

  // Handle numbers (avoid removing leading zeros)
  if (!isNaN(v) && v.trim() !== "" && !/^0\d+/.test(v)) return Number(v);

  return v;
}
