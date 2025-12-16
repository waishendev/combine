import axios, { AxiosInstance } from 'axios';

export interface UploadOptions {
  token: string;
  baseUrl: string;
  axiosInstance?: AxiosInstance;
}

const ensureClient = (opts: UploadOptions): AxiosInstance => {
  return opts.axiosInstance ??
    axios.create({
      baseURL: opts.baseUrl,
      headers: {
        Authorization: `Bearer ${opts.token}`,
      },
    });
};

const appendMaybeFile = (form: FormData, field: string, file?: File | Blob | null) => {
  if (file) {
    form.append(field, file);
  }
};

export interface AnnouncementUpdateInput {
  key?: string;
  title?: string | null;
  subtitle?: string | null;
  body_text?: string | null;
  button_label?: string | null;
  button_link?: string | null;
  is_active?: boolean;
  start_at?: string | null;
  end_at?: string | null;
  show_once_per_session?: boolean;
  sort_order?: number;
  image_path?: string | null;
  image_file?: File | Blob | null;
}

export const updateAnnouncement = async (
  announcementId: number | string,
  input: AnnouncementUpdateInput,
  opts: UploadOptions,
) => {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && key !== 'image_file') {
      form.append(key, value as any);
    }
  });
  appendMaybeFile(form, 'image_file', input.image_file ?? null);
  form.append('_method', 'PUT');

  const client = ensureClient(opts);
  const { data } = await client.post(`/ecommerce/announcements/${announcementId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export interface ProductUpdateInput {
  name?: string;
  slug?: string;
  sku?: string;
  type?: 'single' | 'package';
  description?: string | null;
  price?: number;
  cost_price?: number | null;
  stock?: number;
  low_stock_threshold?: number;
  is_active?: boolean;
  is_featured?: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  meta_og_image?: string | null;
  meta_og_image_file?: File | Blob | null;
  category_ids?: number[];
  images?: (File | Blob)[];
  main_image_index?: number | null;
  delete_image_ids?: number[];
}

export const updateProduct = async (
  productId: number | string,
  input: ProductUpdateInput,
  opts: UploadOptions,
) => {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    if (['images', 'meta_og_image_file'].includes(key)) return;
    if (Array.isArray(value)) {
      value.forEach((v) => form.append(`${key}[]`, v as any));
    } else if (value !== null) {
      form.append(key, value as any);
    } else {
      form.append(key, '');
    }
  });

  appendMaybeFile(form, 'meta_og_image_file', input.meta_og_image_file ?? null);
  input.images?.forEach((file) => form.append('images[]', file));
  form.append('_method', 'PUT');

  const client = ensureClient(opts);
  const { data } = await client.post(`/ecommerce/products/${productId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export interface HomeSliderUpdateInput {
  title?: string;
  subtitle?: string | null;
  button_label?: string | null;
  button_link?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  is_active?: boolean;
  sort_order?: number;
  image_path?: string | null;
  image_file?: File | Blob | null;
  mobile_image_path?: string | null;
  mobile_image_file?: File | Blob | null;
}

export const updateHomeSlider = async (
  sliderId: number | string,
  input: HomeSliderUpdateInput,
  opts: UploadOptions,
) => {
  const form = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || key === 'image_file' || key === 'mobile_image_file') return;
    if (value !== null) {
      form.append(key, value as any);
    } else {
      form.append(key, '');
    }
  });
  appendMaybeFile(form, 'image_file', input.image_file ?? null);
  appendMaybeFile(form, 'mobile_image_file', input.mobile_image_file ?? null);
  form.append('_method', 'PUT');

  const client = ensureClient(opts);
  const { data } = await client.post(`/ecommerce/home-sliders/${sliderId}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};
