// A response entry is either a plain string (local demo mode, keyed by participant name)
// or `{ displayName, value, userId }` (Supabase mode, keyed by user id). These helpers hide
// that shape difference from the components that read responses.
export const getResponseValue = (entry) => {
  if (!entry) return '';
  return typeof entry === 'string' ? entry : entry.value;
};

export const getResponseName = (key, entry) => {
  if (!entry) return key;
  return typeof entry === 'string' ? key : entry.displayName;
};

export const getResponseCounts = (roleResponses = {}, options) =>
  options.map((option) => ({
    option,
    count: Object.values(roleResponses).filter((entry) => getResponseValue(entry) === option).length
  }));

export const getGroupedResponses = (roleResponses = {}, options) =>
  options.map((option) => ({
    option,
    names: Object.entries(roleResponses)
      .filter(([, entry]) => getResponseValue(entry) === option)
      .map(([key, entry]) => getResponseName(key, entry))
      .sort((first, second) => first.localeCompare(second, 'uk'))
  }));

export const buildResponseMap = (rows) => {
  const map = {};

  rows.forEach((row) => {
    map[row.service_id] ??= {};
    map[row.service_id][row.role] ??= {};
    map[row.service_id][row.role][row.user_id] = {
      displayName: row.display_name,
      value: row.value,
      userId: row.user_id
    };
  });

  return map;
};
