"use client";

import { useEffect, useState } from "react";
import { Hero, ServicesPreview, StaticSections } from "@/components/sections/LandingSections";
import { getBookingServices } from "@/lib/apiClient";
import { Service } from "@/lib/types";

export default function HomePage() {
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    getBookingServices().then(setServices).catch(() => setServices([]));
  }, []);

  return (
    <main>
      <Hero />
      <ServicesPreview services={services} />
      <StaticSections />
    </main>
  );
}
