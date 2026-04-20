import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";
import { getBrand } from "@/lib/brand";

const brand = getBrand();

export const metadata = {
  title: brand.title,
  description:
    "Demo application showing how VISS standard vehicle data flows from VISSR simulators into MongoDB and back to drivers via real-time alerts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers brand={brand}>{children}</Providers>
      </body>
    </html>
  );
}
