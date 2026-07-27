import API from './axios';

const unwrap = (response) => response?.data?.data || response?.data?.departments || [];

export const fetchDepartments = async (params = {}) => {
  const response = await API.get('/departments', { params });
  return unwrap(response);
};

export const fetchDepartment = async (id) => {
  const response = await API.get(`/departments/${id}`);
  return response?.data?.data;
};

export const createDepartment = async (payload) => {
  const response = await API.post('/departments', payload);
  return response?.data?.data;
};

export const updateDepartment = async (id, payload) => {
  const response = await API.put(`/departments/${id}`, payload);
  return response?.data?.data;
};

export const getDepartmentId = (department) => {
  if (!department) return '';
  if (typeof department === 'string') return department;
  return department._id || department.id || department.value || '';
};

export const getDepartmentName = (department) => {
  if (!department) return '';
  if (typeof department === 'string') return department;
  return department.name || department.label || department.code || department._id || '';
};
