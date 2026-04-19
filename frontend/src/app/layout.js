import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Connected Trucks",
  description:
    "Demo application showing how VISS standard vehicle data flows from VISSR simulators into MongoDB and back to drivers via real-time alerts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
