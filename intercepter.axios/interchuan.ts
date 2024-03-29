import { getLocalStorage, setLocalStorage } from '@/utils/localStorage';
import axios, { AxiosError, AxiosResponse, AxiosInstance, AxiosRequestConfig } from 'axios';
import { catchError } from '@/utils/catchError';
interface MyAxiosInstance extends AxiosInstance {
  setToken: (token: string) => void;
}

function refreshToken() {
  return instance.get('/auth/refreshToken').then((res) => res.data);
}

const instance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api/v1`,
  withCredentials: true,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json',
    // 'X-Token': getLocalToken(),
  },
}) as MyAxiosInstance;

instance.setToken = (token: string) => {
  //   instance.defaults.headers['X-Token'] = token;
  setLocalStorage('accessToken', token);
};
const ISSERVER = typeof window === 'undefined';

instance.interceptors.request.use(
  (config: AxiosRequestConfig) => {
    if (!ISSERVER) {
      const token = getLocalStorage('accessToken');
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (err: AxiosError) => {
    console.log('-----loi-----');
    return Promise.reject(err);
  },
);
let isRefreshing = false;
let requests: any = [];
instance.interceptors.response.use(
  (response: AxiosResponse) => {
    const { statusCode, message } = response.data;
    const config = response.config || {};
    if (statusCode === 200 && message === 'token_expired' && !config?.url?.includes('/auth/refreshToken')) {
      // lần đầu tiên refeshToken
      if (!isRefreshing) {
        isRefreshing = true;
        return refreshToken()
          .then((res) => {
            const { accessToken = null } = res;
            console.log({ accessToken });
            instance.setToken(accessToken);
            if (config.headers) {
              config.headers.Authorization = `Bearer ${accessToken}`;
            }
            requests.forEach((cb: any) => cb(accessToken));
            requests = [];
            return instance(config);
          })
          .catch((res) => {
            console.error('refreshtoken error =>', res);
            window.location.href = '/';
          })
          .finally(() => {
            isRefreshing = false;
          });
      } else {
        // lần thứ 2 trở đi
        return new Promise((resolve) => {
          requests.push((accessToken: string) => {
            config.baseURL = '';
            if (config.headers) {
              config.headers.Authorization = `Bearer ${accessToken}`;
            }
            resolve(instance(config));
          });
        });
      }
    }
    return response;
  },
  (error) => {
    const err = catchError(error);
    return Promise.reject(err);
  },
);
export default instance;