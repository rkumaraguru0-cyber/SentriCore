import axios from "axios";
export const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export const API_BASE_URL = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach JWT token to every protected API request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("sentricore_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Get all devices
export const getDevices = async () => {
  const response = await api.get("/devices");
  return response.data;
};

// Get security events
export const getSecurityEvents = async () => {
  const response = await api.get("/security-events");
  return response.data;
};

// Acknowledge security event
export const acknowledgeSecurityEvent = async (eventId) => {
  const response = await api.patch(
    `/security-events/${eventId}/acknowledge`
  );

  return response.data;
};

// Resolve security event
export const resolveSecurityEvent = async (eventId) => {
  const response = await api.patch(
    `/security-events/${eventId}/resolve`
  );

  return response.data;
};

// Get incidents
export const getIncidents = async () => {
  const response = await api.get("/incidents");
  return response.data;
};

// Get firmware updates
export const getFirmwareUpdates = async () => {
  const response = await api.get("/firmware");
  return response.data;
};

// Acknowledge incident
export const acknowledgeIncident = async (incidentId) => {
  const response = await api.patch(`/incidents/${incidentId}/acknowledge`);
  return response.data;
};

// Resolve incident
export const resolveIncident = async (incidentId) => {
  const response = await api.patch(`/incidents/${incidentId}/resolve`);
  return response.data;
};

// Get device by ID
export const getDeviceById = async (deviceId) => {
  const response = await api.get(`/devices/${deviceId}`);
  return response.data;
};

// Check firmware update availability for a device
export const checkFirmwareUpdate = async (deviceId) => {
  const response = await api.get(
    `/firmware-releases/device/${deviceId}`
  );

  return response.data;
};

export default api;