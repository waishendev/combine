"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CartDrawer } from "@/components/booking/CartDrawer";

export default function BookingCartPage() {
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    // Automatically open the cart drawer when this page loads
    setCartOpen(true);
  }, []);

  const handleClose = () => {
    setCartOpen(false);
    // Redirect to booking page when drawer is closed
    router.push("/booking");
  };

  return <CartDrawer isOpen={cartOpen} onClose={handleClose} />;
}
