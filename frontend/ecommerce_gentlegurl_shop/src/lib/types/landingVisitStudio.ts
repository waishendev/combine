export type LandingHeading = {
  label: string;
  title: string;
  align: "left" | "center" | "right";
};

export type LandingVisitStudioHoursRow = {
  day_range: string;
  time_range: string;
};

export type LandingVisitStudioLocation = {
  /** When false, location is hidden on the shop (kept in CRM). Defaults to true. */
  is_active?: boolean;
  tab_label: string;
  studio_name: string;
  address: string;
  google_maps_url: string;
  waze_url: string;
  whatsapp_phone: string;
  whatsapp_message: string;
  whatsapp_url?: string;
  google_maps_label: string;
  waze_label: string;
  whatsapp_label: string;
  opening_hours_heading: string;
  opening_hours: LandingVisitStudioHoursRow[];
  bottom_label: string;
  column_order: "contact_left" | "hours_left";
};

export type LandingVisitStudio = {
  is_active: boolean;
  heading: LandingHeading;
  locations: LandingVisitStudioLocation[];
  /** @deprecated use locations[] */
  studio_name?: string;
  /** @deprecated use locations[] */
  address?: string;
  /** @deprecated use locations[] */
  google_maps_url?: string;
  /** @deprecated use locations[] */
  waze_url?: string;
  /** @deprecated use locations[] */
  whatsapp_phone?: string;
  /** @deprecated use locations[] */
  whatsapp_message?: string;
  whatsapp_url?: string;
  /** @deprecated use locations[] */
  google_maps_label?: string;
  /** @deprecated use locations[] */
  waze_label?: string;
  /** @deprecated use locations[] */
  whatsapp_label?: string;
  /** @deprecated use locations[] */
  opening_hours_heading?: string;
  /** @deprecated use locations[] */
  opening_hours?: LandingVisitStudioHoursRow[];
  /** @deprecated use locations[] */
  bottom_label?: string;
  /** @deprecated use locations[] */
  column_order?: "contact_left" | "hours_left";
};
