import { permanentRedirect } from "next/navigation";

/** Store Reviews page retired — send crawlers and users to the homepage. */
export default function ReviewsPage() {
  permanentRedirect("/");
}
