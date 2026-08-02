const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.detail ? JSON.stringify(body.detail) : res.statusText;
    throw new Error(`${res.status} ${message}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** "YYYY-MM" for a given (year, 0-indexed month) */
export function monthParam(year, month0) {
  return `${year}-${pad2(month0 + 1)}`;
}

/** "YYYY-MM-DD" for a given (year, 0-indexed month, day) */
export function dateParam(year, month0, day) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

export function fetchTasks(year, month0) {
  return request(`/api/tasks?month=${monthParam(year, month0)}`);
}

export function createTask({ name, icon, colorKey }) {
  return request('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ name, icon, color_key: colorKey }),
  });
}

export function deleteTask(id) {
  return request(`/api/tasks/${id}`, { method: 'DELETE' });
}

/** month0 is optional and 0-indexed; omit for the full year */
export function fetchCheckins(taskId, year, month0) {
  const q = month0 == null ? `year=${year}` : `year=${year}&month=${month0 + 1}`;
  return request(`/api/tasks/${taskId}/checkins?${q}`);
}

export function toggleCheckin(taskId, year, month0, day) {
  return request(`/api/tasks/${taskId}/checkins/toggle`, {
    method: 'POST',
    body: JSON.stringify({ date: dateParam(year, month0, day) }),
  });
}
