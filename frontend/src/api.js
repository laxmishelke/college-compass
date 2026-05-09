import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000
});

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('collegeCompassToken');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

function getErrorMessage(error) {
  if (axios.isCancel(error)) {
    return 'Request canceled.';
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === 'ECONNABORTED') {
    return 'The server took too long to respond.';
  }

  if (error.request) {
    return 'Unable to reach the API server. Check that the backend is running.';
  }

  return error.message || 'Request failed.';
}

async function request(config) {
  try {
    const response = await http(config);
    return response.data;
  } catch (error) {
    const normalized = new Error(getErrorMessage(error));
    normalized.isCanceled = axios.isCancel(error);
    throw normalized;
  }
}

export const api = {
  login(payload) {
    return request({
      url: '/auth/login',
      method: 'POST',
      data: payload
    });
  },
  register(payload) {
    return request({
      url: '/auth/register',
      method: 'POST',
      data: payload
    });
  },
  me(options = {}) {
    return request({
      url: '/auth/me',
      method: 'GET',
      signal: options.signal
    });
  },
  getColleges(params = {}, options = {}) {
    return request({
      url: '/colleges',
      method: 'GET',
      params,
      signal: options.signal
    });
  },
  getCollege(id, options = {}) {
    return request({
      url: `/colleges/${id}`,
      method: 'GET',
      signal: options.signal
    });
  },
  compareColleges(ids, options = {}) {
    return request({
      url: '/colleges/compare',
      method: 'GET',
      params: { ids: ids.join(',') },
      signal: options.signal
    });
  },
  getSavedColleges(options = {}) {
    return request({
      url: '/saved-colleges',
      method: 'GET',
      signal: options.signal
    });
  },
  saveCollege(collegeId) {
    return request({
      url: `/saved-colleges/${collegeId}`,
      method: 'POST'
    });
  },
  unsaveCollege(collegeId) {
    return request({
      url: `/saved-colleges/${collegeId}`,
      method: 'DELETE'
    });
  }
};

export { API_BASE_URL };
