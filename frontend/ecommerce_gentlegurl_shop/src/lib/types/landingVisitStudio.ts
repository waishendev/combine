export type LandingHeading = {
  label: string;
  title: string;
  align: "left" | "center" | "right";
};

export type LandingVisitStudioHoursRow = {
  day_range: string;
  time_range: string;
};

export type LandingVisitStudio = {
  is_active: boolean;
  heading: LandingHeading;
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
